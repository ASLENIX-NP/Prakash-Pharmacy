import app from "../src/app.js";
import { prisma } from "../src/db.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

async function main() {
  console.log("");
  console.log("=================================================");
  console.log("  Distributor & Inward Purchase Smoke Test");
  console.log("=================================================");

  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.on("listening", () => resolve());
  });

  const address = server.address();
  assert(address && typeof address !== "string", "Could not determine server port.");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const stamp = Date.now();
  const distributorName = `Test Wholesaler ${stamp}`;
  const medicineBrand = `Test Inward Drug ${stamp}`;
  const batchNumber = `INW-${stamp}`;
  const invoiceNumber = `INV-${stamp.toString().slice(-6)}`;

  let distributorNumericId: number | null = null;
  let purchaseNumericId: number | null = null;
  let createdMedicineId: number | null = null;

  try {
    // 1. ADMIN LOGIN
    const login = await requestJson(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    assert(login.response.status === 200, `Admin login failed: ${login.response.status}`);
    const token = login.body?.token;
    assert(typeof token === "string" && token.length > 0, "No token returned.");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    console.log("PASS 1/7  Admin login & JWT authentication");

    // 2. CREATE DISTRIBUTOR
    const createDist = await requestJson(`${baseUrl}/distributors`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: distributorName,
        phone: "9841000000",
        panNumber: "123456789",
        email: "wholesaler@example.com",
        address: "Hetauda, Makwanpur",
        contactPerson: "Mr. Ramesh Sharma",
        creditLimit: 150000,
      }),
    });
    assert(createDist.response.status === 201, `Create distributor failed: HTTP ${createDist.response.status}`);
    const distData = createDist.body?.data;
    distributorNumericId = distData?.distributorId;
    assert(distributorNumericId && distributorNumericId > 0, "Invalid distributor ID.");
    assert(distData.currentBalance === 0, "Initial balance should be 0.");
    console.log(`PASS 2/7  Create distributor "${distributorName}" (${distData.id})`);

    // 3. GET DISTRIBUTORS LIST
    const listDist = await requestJson(`${baseUrl}/distributors?search=${encodeURIComponent(distributorName)}`, {
      headers,
    });
    assert(listDist.response.status === 200, `List distributors failed: HTTP ${listDist.response.status}`);
    assert(Array.isArray(listDist.body?.data) && listDist.body.data.length >= 1, "Distributor not found in list.");
    console.log("PASS 3/7  List distributors with search query");

    // 4. CREATE INWARD PURCHASE BILL
    const purchasePayload = {
      invoiceNumber,
      stockistId: String(distributorNumericId),
      date: "2026-10-27",
      paymentMode: "credit",
      subtotal: 1000,
      discountAmount: 50,
      taxableAmount: 0,
      vatAmount: 0,
      grandTotal: 950,
      items: [
        {
          medicineName: medicineBrand,
          genericName: "Paracetamol 500mg",
          category: "Tablet",
          batchNumber,
          expiryDate: "2028-12-31",
          packQty: 10,
          freePacks: 2,
          unitsPerPack: 10,
          costPrice: 95,
          mrpPrice: 120,
          rackLocation: "Rack A-1",
          isVatApplicable: false,
          lineTotal: 950,
        },
      ],
    };

    const createPur = await requestJson(`${baseUrl}/purchases`, {
      method: "POST",
      headers,
      body: JSON.stringify(purchasePayload),
    });
    assert(createPur.response.status === 201, `Create purchase failed: HTTP ${createPur.response.status}: ${JSON.stringify(createPur.body)}`);
    const purchaseData = createPur.body?.data;
    purchaseNumericId = purchaseData?.purchaseId;
    assert(purchaseNumericId && purchaseNumericId > 0, "Invalid purchase ID.");
    assert(purchaseData.grandTotal === 950, `Expected grandTotal 950, got ${purchaseData.grandTotal}`);
    console.log(`PASS 4/7  Record inward purchase bill #${invoiceNumber} (Grand Total: Rs. 950)`);

    // 5. VERIFY INVENTORY STOCK INCREMENTED
    const invCheck = await prisma.inventory.findFirst({
      where: {
        medicineBrand: medicineBrand,
        batchNumber: batchNumber,
      },
    });
    assert(invCheck, "Inward medicine not found in PostgreSQL inventory!");
    createdMedicineId = invCheck.id;
    // 10 ordered + 2 free = 12 packs
    assert(invCheck.packInStock === 12, `Expected 12 packs in stock (10 ordered + 2 free), got ${invCheck.packInStock}`);
    assert(invCheck.distributorId === distributorNumericId, "Distributor ID not linked to inventory.");
    console.log(`PASS 5/7  Inventory automatically updated in PostgreSQL (Stock: ${invCheck.packInStock} packs)`);

    // 6. RECORD PAYMENT & VERIFY BALANCE
    // Current balance should be 950 (credit purchase)
    const distCheck1 = await prisma.distributor.findUnique({ where: { id: distributorNumericId } });
    assert(Number(distCheck1?.currentBalance) === 950, `Expected balance 950, got ${distCheck1?.currentBalance}`);

    // Pay 500
    const payRes = await requestJson(`${baseUrl}/distributors/${distributorNumericId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: 500,
        paymentMode: "Cheque",
        refNumber: "CHQ-88992",
        notes: "Partial payment for purchase bill",
      }),
    });
    assert(payRes.response.status === 200, `Record payment failed: HTTP ${payRes.response.status}`);
    const remainingBal = payRes.body?.data?.distributor?.currentBalance;
    assert(remainingBal === 450, `Expected remaining balance 450 (950 - 500), got ${remainingBal}`);
    console.log(`PASS 6/7  Distributor payment recorded. Balance reduced to Rs. ${remainingBal}`);

    // 7. GET DISTRIBUTOR LEDGER & GLOBAL ADJUSTMENTS
    const ledgerRes = await requestJson(`${baseUrl}/distributors/${distributorNumericId}/ledger`, {
      headers,
    });
    assert(ledgerRes.response.status === 200, `Get ledger failed: HTTP ${ledgerRes.response.status}`);
    const entries = ledgerRes.body?.data;
    assert(Array.isArray(entries) && entries.length === 2, `Expected 2 ledger entries (1 purchase + 1 payment), got ${entries?.length}`);
    console.log("PASS 7/7  Distributor Ledger statement verified (Purchase credit + Payment debit)");

    // Extra: verify global adjustments endpoint
    const adjRes = await requestJson(`${baseUrl}/inventory/adjustments`, { headers });
    assert(adjRes.response.status === 200, "GET /api/inventory/adjustments failed");

    console.log("");
    console.log("=================================================");
    console.log("  ALL DISTRIBUTOR & PURCHASE TESTS PASSED (100%)");
    console.log("=================================================");
  } finally {
    // CLEANUP
    if (purchaseNumericId) {
      await prisma.purchaseInvoiceItem.deleteMany({ where: { invoiceId: purchaseNumericId } });
      await prisma.purchaseInvoice.deleteMany({ where: { id: purchaseNumericId } });
    }
    if (createdMedicineId) {
      await prisma.inventory.deleteMany({ where: { id: createdMedicineId } });
    }
    if (distributorNumericId) {
      await prisma.ledger.deleteMany({ where: { distributorId: distributorNumericId } });
      await prisma.distributor.deleteMany({ where: { id: distributorNumericId } });
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
