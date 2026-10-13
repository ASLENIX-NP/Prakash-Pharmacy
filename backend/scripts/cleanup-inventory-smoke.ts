import { prisma } from "../src/db.js";

async function main() {
  console.log("");
  console.log(
    "Cleaning previous Inventory/Generic smoke-test data..."
  );

  const medicines =
    await prisma.inventory.findMany({
      where: {
        medicineBrand: {
          startsWith:
            "Backend Smoke Medicine",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        medicineBrand: true,
        batchNumber: true,
      },
    });

  for (const medicine of medicines) {
    await prisma.inventory.delete({
      where: {
        id: medicine.id,
      },
    });

    console.log(
      `Deleted test medicine ID ${medicine.id}: ${medicine.medicineBrand}`
    );
  }

  const generics =
    await prisma.generic.findMany({
      where: {
        name: {
          startsWith:
            "Backend Smoke Generic",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

  for (const generic of generics) {

    const linked =
      await prisma.inventory.count({
        where: {
          genericId: generic.id,
        },
      });

    if (linked === 0) {
      await prisma.generic.delete({
        where: {
          id: generic.id,
        },
      });

      console.log(
        `Deleted test generic ID ${generic.id}: ${generic.name}`
      );
    }
  }

  console.log(
    `Cleanup complete. ${medicines.length} medicine(s) removed.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
