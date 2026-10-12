import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

async function main() {
  console.log("🌱 Seeding default users into user_tbl...");

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

    const upserted = await prisma.user.upsert({
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

    console.log(`✓ User '${upserted.username}' (${upserted.role}) ready`);
  }

  console.log("🎉 User seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
