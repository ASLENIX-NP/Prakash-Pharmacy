import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  console.log("🧹 Starting sales & billing data reset to 0...");

  // 1. Delete sales returns
  const deletedReturnItems = await prisma.salesReturnItem.deleteMany({});
  console.log(`✓ Deleted ${deletedReturnItems.count} sales return items`);

  const deletedReturns = await prisma.salesReturn.deleteMany({});
  console.log(`✓ Deleted ${deletedReturns.count} sales return credit notes`);

  // 2. Delete bill items and bills
  const deletedBillItems = await prisma.billItem.deleteMany({});
  console.log(`✓ Deleted ${deletedBillItems.count} bill line items`);

  const deletedBills = await prisma.bill.deleteMany({});
  console.log(`✓ Deleted ${deletedBills.count} sales bills / invoices`);

  // 3. Reset invoice and credit note counters back to 1
  const updatedSettings = await prisma.pharmacySettings.updateMany({
    data: {
      nextInvoiceNumber: 1,
      nextCreditNoteNumber: 1,
    },
  });
  console.log(`✓ Reset invoice and credit note counters to 1 (${updatedSettings.count} settings updated)`);

  console.log("\n🎉 SUCCESS! All sales, revenue, profit, and customer credit have been reset to 0.00.");
  console.log("   (Medicines, stock, stockists, and user accounts were kept safe and intact.)");
}

main()
  .catch((err) => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
