import "dotenv/config";
import bcrypt from "bcryptjs";
import app from "./app.js";
import { checkDatabaseConnection, prisma } from "./db.js";

const PORT = Number(process.env.PORT) || 4000;

async function ensureInitialAdminAndSettings(): Promise<void> {
  try {
    const adminCount = await prisma.user.count({
      where: { role: { equals: "admin", mode: "insensitive" } },
    });

    if (adminCount === 0) {
      const username = process.env.SEED_ADMIN_USERNAME?.trim();
      const rawPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

      if (!username || !rawPassword) {
        console.error("❌ [BOOTSTRAP] No administrator account exists.");
        console.error(
          "   Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD before starting the backend."
        );
        process.exit(1);
      }

      const hasStrongPassword =
        rawPassword.length >= 12 &&
        /[a-z]/.test(rawPassword) &&
        /[A-Z]/.test(rawPassword) &&
        /\d/.test(rawPassword) &&
        /[^A-Za-z0-9]/.test(rawPassword);

      if (!hasStrongPassword) {
        console.error(
          "❌ [BOOTSTRAP] SEED_ADMIN_PASSWORD must be at least 12 characters and contain uppercase, lowercase, number, and special character."
        );
        process.exit(1);
      }
      const firstName = process.env.SEED_ADMIN_FIRST_NAME?.trim() || "Prakash";
      const lastName = process.env.SEED_ADMIN_LAST_NAME?.trim() || "Dulal";
      const email = process.env.SEED_ADMIN_EMAIL?.trim() || null;
      const initials = `${firstName[0] || "P"}${lastName[0] || "D"}`.toUpperCase();

      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const user = await prisma.user.create({
        data: {
          id: "ADM-001",
          username,
          password: hashedPassword,
          firstName,
          lastName,
          initials,
          email,
          role: "admin",
          status: "active",
        },
      });

      console.log(`👑 [BOOTSTRAP] Created initial administrator account:`);
      console.log(`   - Username: ${user.username}`);

    }

    const settingsCount = await prisma.pharmacySetting.count();
    if (settingsCount === 0) {
      await prisma.pharmacySetting.create({
        data: {
          storeName: "Prakash Pharmacy",
          address: "Hetauda-5, Sanopokhara, Makwanpur, Nepal",
          phoneNumber: "+977-057-521480",
          emailId: "prakashpharmacy2021@gmail.com",
          panNumber: "123798907",
          ddaLicenceNumber: "3780516073935",
          vatRegistered: true,
          pharmacistName: "Prakash Dulal",
          pharmacistCouncilRegNumber: "NPC-1425",
          currency: "NPR",
          fiscalYear: "2081/82",
          invoicePrefix: "PP-2081/82-",
          nextInvoiceNumber: 101,
          defaultInvoiceSize: "A5",
          invoiceDateFormat: "BS",
          receiptFooterNote:
            "Thank you for choosing Prakash Pharmacy! Medicines cannot be refunded after 7 days without bill.",
          defaultLowStockThreshold: 15,
          nearExpiryThresholdMonths: 6,
        },
      });
      console.log(`⚙️  [BOOTSTRAP] Initialized default pharmacy store settings.`);
    }
  } catch (error) {
    console.error("⚠️  Failed to bootstrap initial admin or settings:", error);
  }
}

app.listen(PORT, async () => {
  console.log("==================================================");
  console.log(`🚀 Backend server is running successfully!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log("--------------------------------------------------");

  const dbHealth = await checkDatabaseConnection();

  if (dbHealth.connected) {
    console.log(`✅ PostgreSQL is connected successfully!`);
    console.log(`🗄️  Database: ${dbHealth.database}`);
    console.log(`👤 User:     ${dbHealth.user}`);
    console.log(`📦 Version:  ${dbHealth.version}`);

    await ensureInitialAdminAndSettings();

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "purchase_invoice_items_tbl"
          ALTER COLUMN "pack_qty" TYPE DECIMAL(10, 2),
          ALTER COLUMN "free_packs" TYPE DECIMAL(10, 2);
      `);
    } catch {
      // Safe fallback if already migrated or during initial table provisioning
    }
  } else {
    console.error(`❌ PostgreSQL connection failed!`);
    console.error(`⚠️  Error: ${dbHealth.error}`);
  }
  console.log("==================================================");
});

