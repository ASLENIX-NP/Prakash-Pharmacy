import "dotenv/config";
import app from "../src/app.js";

type JsonObject = Record<string, any>;

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error("Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD before running this smoke test.");
}

let token = "";
let createdMedicineId: string | null = null;
let createdGenericId: string | null = null;

function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function api(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<{
  status: number;
  body: JsonObject;
}> {
  const headers = new Headers(
    options.headers
  );

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${baseUrl}${path}`,
    {
      ...options,
      headers,
    }
  );

  const raw =
    await response.text();

  let body: JsonObject = {};

  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = {
        message: raw,
      };
    }
  }

  return {
    status: response.status,
    body,
  };
}

async function run() {
  const server = app.listen(
    0,
    "127.0.0.1"
  );

  await new Promise<void>(
    (resolve) => {
      server.once(
        "listening",
        () => resolve()
      );
    }
  );

  const address =
    server.address();

  assert(
    address &&
      typeof address === "object",
    "Could not determine smoke-test port."
  );

  const baseUrl =
    `http://127.0.0.1:${address.port}`;

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    " Inventory + Generic Backend Smoke Test"
  );
  console.log(
    "=============================================="
  );

  try {
    // ------------------------------------------
    // 1. HEALTH
    // ------------------------------------------
    const health =
      await api(
        baseUrl,
        "/api/health"
      );

    assert(
      health.status === 200,
      `Health check failed (${health.status}): ${health.body.message ?? ""}`
    );

    console.log(
      "PASS  1/13  Backend + PostgreSQL health"
    );


    // ------------------------------------------
    // 2. LOGIN
    // ------------------------------------------
    const login =
      await api(
        baseUrl,
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              ADMIN_USERNAME,
            password:
              ADMIN_PASSWORD,
          }),
        }
      );

    assert(
      login.status === 200 &&
        login.body.token,
      `Admin login failed (${login.status}): ${login.body.message ?? ""}`
    );

    token =
      login.body.token;

    console.log(
      "PASS  2/13  Admin JWT login"
    );


    // ------------------------------------------
    // 3. INVENTORY LIST
    // ------------------------------------------
    const inventory =
      await api(
        baseUrl,
        "/api/inventory?limit=all"
      );

    assert(
      inventory.status === 200 &&
        Array.isArray(
          inventory.body.data
        ),
      "Inventory list failed."
    );

    console.log(
      `PASS  3/13  Inventory list (${inventory.body.data.length} rows)`
    );


    // ------------------------------------------
    // 4. LOW STOCK FILTER
    // ------------------------------------------
    const lowStock =
      await api(
        baseUrl,
        "/api/inventory?lowStock=true&limit=all"
      );

    assert(
      lowStock.status === 200 &&
        Array.isArray(
          lowStock.body.data
        ),
      "Low-stock filter failed."
    );

    console.log(
      `PASS  4/13  Low-stock filter (${lowStock.body.data.length} rows)`
    );


    // ------------------------------------------
    // 5. VAT FILTER
    // ------------------------------------------
    const vat =
      await api(
        baseUrl,
        "/api/inventory?hasvat=true&limit=all"
      );

    assert(
      vat.status === 200 &&
        Array.isArray(
          vat.body.data
        ),
      "VAT filter failed."
    );

    console.log(
      `PASS  5/13  13% VAT filter (${vat.body.data.length} rows)`
    );


    // ------------------------------------------
    // 6. INVENTORY SUMMARY
    // ------------------------------------------
    const summary =
      await api(
        baseUrl,
        "/api/inventory/alerts/summary"
      );

    assert(
      summary.status === 200 &&
        summary.body.data,
      "Inventory summary failed."
    );

    assert(
      typeof summary.body.data
        .totalRetailValuationNPR ===
        "number",
      "Inventory valuation missing."
    );

    console.log(
      "PASS  6/13  Inventory summary + valuation"
    );


    // ------------------------------------------
    // 7. NEAR EXPIRY
    // ------------------------------------------
    const nearExpiry =
      await api(
        baseUrl,
        "/api/inventory/alerts/near-expiry?months=6"
      );

    assert(
      nearExpiry.status === 200 &&
        Array.isArray(
          nearExpiry.body.data
        ),
      "Near-expiry API failed."
    );

    console.log(
      `PASS  7/13  Near-expiry API (${nearExpiry.body.data.length} rows)`
    );


    // ------------------------------------------
    // 8. GENERIC LIST
    // ------------------------------------------
    const generics =
      await api(
        baseUrl,
        "/api/generics"
      );

    assert(
      generics.status === 200 &&
        Array.isArray(
          generics.body.data
        ),
      "Generic list failed."
    );

    console.log(
      `PASS  8/13  Generic list (${generics.body.data.length} generics)`
    );


    // ------------------------------------------
    // 9. GENERIC CATALOG
    // ------------------------------------------
    const catalog =
      await api(
        baseUrl,
        "/api/generics/catalog"
      );

    assert(
      catalog.status === 200 &&
        Array.isArray(
          catalog.body.data
        ),
      "Generic catalog failed."
    );

    console.log(
      `PASS  9/13  Generic grouped catalog (${catalog.body.data.length} groups)`
    );


    // ------------------------------------------
    // 10. CREATE TEMP GENERIC
    // ------------------------------------------
    const unique =
      Date.now();

    const genericName =
      `Backend Smoke Generic ${unique}`;

    const createGeneric =
      await api(
        baseUrl,
        "/api/generics",
        {
          method: "POST",
          body: JSON.stringify({
            name: genericName,
          }),
        }
      );

    assert(
      createGeneric.status === 201 &&
        createGeneric.body.data?.id,
      `Create generic failed (${createGeneric.status}): ${createGeneric.body.message ?? ""}`
    );

    createdGenericId =
      createGeneric.body.data.id;

    console.log(
      `PASS 10/13  Create Generic (${createdGenericId})`
    );


    // ------------------------------------------
    // 11. CREATE / UPDATE MEDICINE
    // ------------------------------------------
    const medicineName =
      `Backend Smoke Medicine ${unique}`;

    const batch =
      `SMOKE-${unique}`;

    const createMedicine =
      await api(
        baseUrl,
        "/api/inventory",
        {
          method: "POST",
          body: JSON.stringify({
            name: medicineName,
            genericName,
            category:
              "Tablet",
            batchNumber:
              batch,
            expiryDate:
              "2028-12-31",
            unitsPerPack:
              10,
            stockPacks:
              8,
            stockLooseUnits:
              3,
            costPrice:
              100,
            mrpPrice:
              140,
            reorderLevel:
              5,
            rackLocation:
              "Rack A-1",
            isVatApplicable:
              false,
          }),
        }
      );

    assert(
      createMedicine.status === 201 &&
        createMedicine.body.data?.id,
      `Create medicine failed (${createMedicine.status}): ${createMedicine.body.message ?? ""}`
    );

    createdMedicineId =
      createMedicine.body.data.id;

    const updateMedicine =
      await api(
        baseUrl,
        `/api/inventory/${encodeURIComponent(createdMedicineId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            stockPacks: 11,
            stockLooseUnits: 4,
            mrpPrice: 150,
          }),
        }
      );

    assert(
      updateMedicine.status === 200 &&
        updateMedicine.body.data
          ?.stockPacks === 11 &&
        updateMedicine.body.data
          ?.stockLooseUnits === 4,
      "Medicine update failed."
    );

    console.log(
      `PASS 11/13  Create + Update Medicine (${createdMedicineId})`
    );


    // ------------------------------------------
    // 12. DUPLICATE PROTECTION
    // ------------------------------------------
    const duplicate =
      await api(
        baseUrl,
        "/api/inventory",
        {
          method: "POST",
          body: JSON.stringify({
            name:
              medicineName.toUpperCase(),
            genericName,
            category:
              "Tablet",
            batchNumber:
              batch.toLowerCase(),
            expiryDate:
              "2028-12-31",
            unitsPerPack:
              10,
            stockPacks:
              1,
            stockLooseUnits:
              0,
            costPrice:
              100,
            mrpPrice:
              140,
            reorderLevel:
              5,
            rackLocation:
              "Rack A-1",
            isVatApplicable:
              false,
          }),
        }
      );

    assert(
      duplicate.status === 409,
      `Duplicate medicine should return 409, received ${duplicate.status}.`
    );

    console.log(
      "PASS 12/13  Duplicate brand + batch protection"
    );


    // ------------------------------------------
    // 13. BULK IMPORT
    //
    // Use skip mode against the temporary
    // medicine so no stock values change.
    // ------------------------------------------
    const bulk =
      await api(
        baseUrl,
        "/api/inventory/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "skip",
            items: [
              {
                name:
                  medicineName,
                genericName,
                category:
                  "Tablet",
                batchNumber:
                  batch,
                expiryDate:
                  "2028-12-31",
                unitsPerPack:
                  10,
                stockPacks:
                  50,
                stockLooseUnits:
                  0,
                costPrice:
                  100,
                mrpPrice:
                  150,
                reorderLevel:
                  5,
                rackLocation:
                  "Rack A-1",
                isVatApplicable:
                  false,
              },
            ],
          }),
        }
      );

    assert(
      bulk.status === 200 &&
        bulk.body.summary?.skipped ===
          1,
      `Bulk import skip test failed (${bulk.status}).`
    );

    console.log(
      "PASS 13/13  Bulk import duplicate skip"
    );


    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      " ALL INVENTORY + GENERIC TESTS PASSED"
    );
    console.log(
      "=============================================="
    );
  } finally {

    // ------------------------------------------
    // CLEAN UP TEMP MEDICINE
    // ------------------------------------------
    if (token && createdMedicineId) {
      try {
        await api(
          baseUrl,
          `/api/inventory/${encodeURIComponent(createdMedicineId)}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        // Cleanup should not hide
        // the original test result.
      }
    }


    // ------------------------------------------
    // CLEAN UP TEMP GENERIC
    // ------------------------------------------
    if (token && createdGenericId) {
      try {
        await api(
          baseUrl,
          `/api/generics/${encodeURIComponent(createdGenericId)}`,
          {
            method: "DELETE",
          }
        );
      } catch {
        // Ignore cleanup error.
      }
    }


    await new Promise<void>(
      (resolve) =>
        server.close(
          () => resolve()
        )
    );
  }
}

run()
  .catch((error) => {
    console.error("");
    console.error(
      "SMOKE TEST FAILED:"
    );
    console.error(error);

    process.exitCode = 1;
  });
