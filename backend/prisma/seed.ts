import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set to create the initial administrator.`);
  }
  return value;
}

async function main() {
  const username = requiredSetting("SEED_ADMIN_USERNAME");
  const password = requiredSetting("SEED_ADMIN_PASSWORD");
  const firstName = requiredSetting("SEED_ADMIN_FIRST_NAME");
  const lastName = requiredSetting("SEED_ADMIN_LAST_NAME");
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || null;

  if (password.length < 6) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 6 characters long.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    if (existingUser.role.toLowerCase() !== "admin") {
      throw new Error(
        `SEED_ADMIN_USERNAME "${username}" already belongs to a non-administrator account.`
      );
    }
    console.log(`Administrator "${username}" already exists; leaving its credentials unchanged.`);
  } else {
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const user = await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(password, 10),
        firstName,
        lastName,
        initials,
        email,
        role: "admin",
        status: "active",
      },
    });

    console.log(`Created initial administrator "${user.username}" (${user.id}).`);
  }

  // Ensure default pharmacy settings exist
  const existingSetting = await prisma.pharmacySetting.findFirst();
  if (!existingSetting) {
    await prisma.pharmacySetting.create({
      data: {
        storeName: "Prakash Pharmacy",
        address: "Makwanpur, Nepal",
        phoneNumber: "9800000000",
        emailId: "contact@prakashpharmacy.com",
        panNumber: "600123456",
        ddaLicenceNumber: "DDA-MAK-1042",
        vatRegistered: true,
        pharmacistName: "Prakash Bhatta",
        pharmacistCouncilRegNumber: "NPC-1425",
        currency: "NPR",
        fiscalYear: "2081/82",
        invoicePrefix: "PP-2081/82-",
        nextInvoiceNumber: 101,
        defaultInvoiceSize: "A5",
        invoiceDateFormat: "BS",
        receiptFooterNote: "Thank you for your visit. Medicines once sold cannot be returned without original bill.",
        defaultLowStockThreshold: 15,
        nearExpiryThresholdMonths: 6,
      },
    });
    console.log("Created initial pharmacy store settings.");
  }
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
