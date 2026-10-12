import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import {
  formatMedicineCode,
  formatRackCode,
  formatCategoryCode,
  formatGenericCode,
} from "../src/utils/id.helpers.js";

async function main() {
  console.log("==================================================");
  console.log("🌱 Prakash Pharmacy Database Seed");
  console.log("==================================================");

  // ==========================================
  // 1. Seed Users (Admin & Staff)
  // ==========================================
  console.log("\n👤 1. Seeding Staff & Admin Users...");
  const usersToSeed = [
    {
      id: "ADM-001",
      username: "admin",
      passwordRaw: "admin123",
      firstName: "Prakash",
      lastName: "Dulal",
      initials: "PD",
      role: "admin",
      email: "admin@prakashpharmacy.com.np",
      phoneNumber: "+977-9855012345",
      shift: "Full Day / Proprietor",
      status: "active",
    },
    {
      id: "STF-001",
      username: "suman.staff",
      passwordRaw: "staff123",
      firstName: "Suman",
      lastName: "Shrestha",
      initials: "SS",
      role: "staff",
      email: "suman@prakashpharmacy.com.np",
      phoneNumber: "+977-9845112233",
      shift: "Morning (7:00 AM - 3:00 PM)",
      status: "active",
    },
    {
      id: "STF-002",
      username: "rita.staff",
      passwordRaw: "staff123",
      firstName: "Rita",
      lastName: "Adhikari",
      initials: "RA",
      role: "staff",
      email: "rita@prakashpharmacy.com.np",
      phoneNumber: "+977-9812998877",
      shift: "Evening (2:00 PM - 9:00 PM)",
      status: "active",
    },
  ];

  for (const u of usersToSeed) {
    const hashedPassword = await bcrypt.hash(u.passwordRaw, 10);
    const userRecord = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        password: hashedPassword,
        firstName: u.firstName,
        lastName: u.lastName,
        initials: u.initials,
        role: u.role,
        email: u.email,
        phoneNumber: u.phoneNumber,
        shift: u.shift,
        status: u.status,
      },
      create: {
        id: u.id,
        username: u.username,
        password: hashedPassword,
        firstName: u.firstName,
        lastName: u.lastName,
        initials: u.initials,
        role: u.role,
        email: u.email,
        phoneNumber: u.phoneNumber,
        shift: u.shift,
        status: u.status,
      },
    });
    console.log(`  ✓ [${userRecord.id}] ${userRecord.username} (${userRecord.firstName} ${userRecord.lastName} - ${userRecord.role.toUpperCase()})`);
  }

  // ==========================================
  // 2. Seed Categories with Standard Codes (CAT-001, CAT-002...)
  // ==========================================
  console.log("\n🏷️  2. Seeding Dosage Categories...");
  const categoriesToSeed = [
    { code: "CAT-001", name: "Tablet" },
    { code: "CAT-002", name: "Capsule" },
    { code: "CAT-003", name: "Syrup" },
    { code: "CAT-004", name: "Suspension" },
    { code: "CAT-005", name: "Injection" },
    { code: "CAT-006", name: "Ointment" },
    { code: "CAT-007", name: "Cream" },
    { code: "CAT-008", name: "Drops" },
    { code: "CAT-009", name: "Inhaler" },
    { code: "CAT-010", name: "Antiseptic Solution" },
    { code: "CAT-011", name: "Medicated Gel" },
    { code: "CAT-012", name: "Device / Surgical" },
    { code: "CAT-013", name: "OTC Cosmetic" },
    { code: "CAT-014", name: "Other" },
  ];

  const categoryMap = new Map<string, number>();
  for (const c of categoriesToSeed) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name },
    });
    categoryMap.set(c.name, cat.id);
    console.log(`  ✓ [${formatCategoryCode(cat.id)}] ${cat.name}`);
  }

  // ==========================================
  // 3. Seed Storage Racks with Codes (RCK-001, RCK-002...)
  // ==========================================
  console.log("\n🗄️  3. Seeding Storage Racks...");
  const racksToSeed = [
    { code: "RCK-001", name: "Rack A-1", description: "Top Antibiotics & Essential Antibacterials" },
    { code: "RCK-002", name: "Rack A-2", description: "Acid Peptic, PPIs & Antacids" },
    { code: "RCK-003", name: "Rack A-3", description: "Respiratory Drugs & Macrolides" },
    { code: "RCK-004", name: "Rack B-1", description: "Antipyretics & Analgesics (Paracetamol)" },
    { code: "RCK-005", name: "Rack B-2", description: "Antihistamines, Cough & Allergy" },
    { code: "RCK-006", name: "Rack C-1", description: "Antidiabetic & Antihypertensive Chronic Care" },
    { code: "RCK-007", name: "Syrup Bay 1", description: "Pediatric Syrups & Oral Suspensions" },
    { code: "RCK-008", name: "Antiseptic Shelf", description: "Antiseptics, Povidone & Wound Disinfectants (13% VAT)" },
    { code: "RCK-009", name: "Ointment Bay 2", description: "Medicated Gels, Pain Relief Creams (13% VAT)" },
    { code: "RCK-010", name: "Device Showcase", description: "Glucometer Strips, Thermometers & Devices (13% VAT)" },
    { code: "RCK-011", name: "OTC Shelf 1", description: "ORS Jeevan Jal Sachets & Oral Rehydration" },
    { code: "RCK-012", name: "Cold Storage", description: "Biologicals, Insulins & Temperature Sensitive" },
  ];

  const rackMap = new Map<string, number>();
  for (const r of racksToSeed) {
    const rack = await prisma.rack.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    rackMap.set(r.name, rack.id);
    console.log(`  ✓ [${formatRackCode(rack.id)}] ${rack.name} (${rack.description})`);
  }

  // ==========================================
  // 4. Seed Generics & Medicines with Codes (MED-001, MED-002...)
  // ==========================================
  console.log("\n💊 4. Seeding Medicines & Inventory...");
  const sampleMedicines = [
    {
      code: "MED-001",
      brand: "Augmentin 625 Duo",
      generic: "Amoxicillin 500mg + Clavulanic Acid 125mg",
      category: "Tablet",
      rack: "Rack A-1",
      batch: "AUG625-88",
      expiry: "2027-08-15",
      unitPerPack: 10,
      packInStock: 85,
      unitInStock: 4,
      packAlertLevel: 20,
      costPrice: 220.0,
      sellingPrice: 310.0,
      hasvat: false,
    },
    {
      code: "MED-002",
      brand: "Pan 40",
      generic: "Pantoprazole 40mg",
      category: "Tablet",
      rack: "Rack A-2",
      batch: "PAN7712",
      expiry: "2027-07-15",
      unitPerPack: 15,
      packInStock: 95,
      unitInStock: 5,
      packAlertLevel: 25,
      costPrice: 110.0,
      sellingPrice: 155.0,
      hasvat: false,
    },
    {
      code: "MED-003",
      brand: "Pantop 40",
      generic: "Pantoprazole 40mg",
      category: "Tablet",
      rack: "Rack A-2",
      batch: "PNP2219",
      expiry: "2026-11-10",
      unitPerPack: 10,
      packInStock: 8, // Low stock & near expiry
      unitInStock: 2,
      packAlertLevel: 15,
      costPrice: 72.0,
      sellingPrice: 105.0,
      hasvat: false,
    },
    {
      code: "MED-004",
      brand: "Azithral 500",
      generic: "Azithromycin 500mg",
      category: "Tablet",
      rack: "Rack A-3",
      batch: "AZI9011",
      expiry: "2027-04-20",
      unitPerPack: 5,
      packInStock: 60,
      unitInStock: 2,
      packAlertLevel: 15,
      costPrice: 95.0,
      sellingPrice: 135.0,
      hasvat: false,
    },
    {
      code: "MED-005",
      brand: "Dolo 650",
      generic: "Paracetamol 650mg",
      category: "Tablet",
      rack: "Rack B-1",
      batch: "DOL5521",
      expiry: "2028-01-10",
      unitPerPack: 15,
      packInStock: 120,
      unitInStock: 8,
      packAlertLevel: 30,
      costPrice: 32.0,
      sellingPrice: 48.0,
      hasvat: false,
    },
    {
      code: "MED-006",
      brand: "Cetzine 10mg",
      generic: "Cetirizine Hydrochloride 10mg",
      category: "Tablet",
      rack: "Rack B-2",
      batch: "CTZ3391",
      expiry: "2027-06-12",
      unitPerPack: 10,
      packInStock: 75,
      unitInStock: 6,
      packAlertLevel: 15,
      costPrice: 28.0,
      sellingPrice: 42.0,
      hasvat: false,
    },
    {
      code: "MED-007",
      brand: "Ascoril-D Plus Syrup 100ml",
      generic: "Dextromethorphan + Phenylephrine + CPM",
      category: "Syrup",
      rack: "Syrup Bay 1",
      batch: "ASC4412",
      expiry: "2027-05-30",
      unitPerPack: 1,
      packInStock: 45,
      unitInStock: 0,
      packAlertLevel: 12,
      costPrice: 92.0,
      sellingPrice: 128.0,
      hasvat: false,
    },
    {
      code: "MED-008",
      brand: "Betadine 10% Solution 100ml",
      generic: "Povidone Iodine 10% w/v Antiseptic",
      category: "Antiseptic Solution",
      rack: "Antiseptic Shelf",
      batch: "BTD4029",
      expiry: "2027-06-30",
      unitPerPack: 1,
      packInStock: 35,
      unitInStock: 0,
      packAlertLevel: 10,
      costPrice: 110.0,
      sellingPrice: 158.0,
      hasvat: true, // 13% VAT
    },
    {
      code: "MED-009",
      brand: "Volini Pain Relief Gel 30g",
      generic: "Diclofenac Diethylamine + Virgin Linseed Oil",
      category: "Medicated Gel",
      rack: "Ointment Bay 2",
      batch: "VOL8812",
      expiry: "2027-08-30",
      unitPerPack: 1,
      packInStock: 40,
      unitInStock: 0,
      packAlertLevel: 10,
      costPrice: 105.0,
      sellingPrice: 145.0,
      hasvat: true, // 13% VAT
    },
  ];

  for (const m of sampleMedicines) {
    // 1. Upsert Generic
    const gen = await prisma.generic.upsert({
      where: { name: m.generic },
      update: {},
      create: { name: m.generic },
    });

    const catId = categoryMap.get(m.category) ?? 1;
    const rkId = rackMap.get(m.rack) ?? null;

    // 2. Check if medicine already exists with same brand and batch
    const existing = await prisma.inventory.findFirst({
      where: {
        medicineBrand: m.brand,
        batchNumber: m.batch,
      },
    });

    let invRecord;
    if (!existing) {
      invRecord = await prisma.inventory.create({
        data: {
          medicineBrand: m.brand,
          batchNumber: m.batch,
          expiryDate: m.expiry,
          genericId: gen.id,
          categoryId: catId,
          rackId: rkId,
          unitPerPack: m.unitPerPack,
          packInStock: m.packInStock,
          unitInStock: m.unitInStock,
          packAlertLevel: m.packAlertLevel,
          costPrice: m.costPrice,
          sellingPrice: m.sellingPrice,
          hasvat: m.hasvat,
        },
      });
    } else {
      invRecord = existing;
    }

    const medCode = formatMedicineCode(invRecord.id);
    const genCode = formatGenericCode(gen.id);
    const catCode = formatCategoryCode(catId);
    const rkCode = rkId ? formatRackCode(rkId) : "Unassigned";

    console.log(
      `  ✓ [${medCode}] ${invRecord.medicineBrand.padEnd(28)} | Generic: ${genCode} | Category: ${catCode} | Rack: ${rkCode} | Batch: ${invRecord.batchNumber}`
    );
  }

  console.log("\n==================================================");
  console.log("🎉 Seed completed with formatted professional IDs!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
