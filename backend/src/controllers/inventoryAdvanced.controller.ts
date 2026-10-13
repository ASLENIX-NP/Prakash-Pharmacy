import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatInventoryItem } from "./inventory.controller.js";

type AnyRecord = Record<string, any>;

const cleanString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const toInt = (
  value: unknown,
  fallback = 0,
  minimum = 0
): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
};

const toNumber = (
  value: unknown,
  fallback = 0,
  minimum = 0
): number => {
  const parsed = Number.parseFloat(String(value ?? ""));

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
};

const toBoolean = (
  value: unknown,
  fallback = false
): boolean => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "13%" ||
    normalized === "vat"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "vat free" ||
    normalized === "0%"
  ) {
    return false;
  }

  return fallback;
};

async function resolveGeneric(item: AnyRecord): Promise<number> {
  const rawGenericId =
    item.genericId ??
    item.generic?.id;

  if (rawGenericId !== undefined && rawGenericId !== null) {
    const match = String(rawGenericId).match(/\d+/);

    if (match) {
      const id = Number.parseInt(match[0], 10);

      const existing = await prisma.generic.findUnique({
        where: { id },
      });

      if (existing) {
        return existing.id;
      }
    }
  }

  const genericName = cleanString(
    item.genericName ??
    item.generic?.name ??
    item.generic
  );

  if (!genericName) {
    throw new Error("Generic Salt / Molecule is required.");
  }

  const generic = await prisma.generic.upsert({
    where: { name: genericName },
    update: {},
    create: { name: genericName },
  });

  return generic.id;
}

async function resolveCategory(item: AnyRecord): Promise<number> {
  const rawCategoryId =
    item.categoryId ??
    item.categoryDetails?.id;

  if (rawCategoryId !== undefined && rawCategoryId !== null) {
    const match = String(rawCategoryId).match(/\d+/);

    if (match) {
      const id = Number.parseInt(match[0], 10);

      const existing = await prisma.category.findUnique({
        where: { id },
      });

      if (existing) {
        return existing.id;
      }
    }
  }

  const categoryName =
    cleanString(
      item.categoryName ??
      item.categoryDetails?.name ??
      item.category
    ) || "Tablet";

  const category = await prisma.category.upsert({
    where: { name: categoryName },
    update: {},
    create: { name: categoryName },
  });

  return category.id;
}

async function resolveRack(
  item: AnyRecord
): Promise<number | null> {
  const rawRackId =
    item.rackId ??
    item.rack?.id;

  if (rawRackId !== undefined && rawRackId !== null) {
    const rawValue = String(rawRackId).trim().toLowerCase();

    if (
      rawValue === "null" ||
      rawValue === "unassigned" ||
      rawValue === ""
    ) {
      return null;
    }

    const match = String(rawRackId).match(/\d+/);

    if (match) {
      const id = Number.parseInt(match[0], 10);

      const existing = await prisma.rack.findUnique({
        where: { id },
      });

      if (existing) {
        return existing.id;
      }
    }
  }

  const rackName = cleanString(
    item.rackName ??
    item.rackLocation ??
    item.rack?.name
  );

  if (
    !rackName ||
    rackName.toLowerCase() === "unassigned"
  ) {
    return null;
  }

  const rack = await prisma.rack.upsert({
    where: { name: rackName },
    update: {},
    create: {
      name: rackName,
    },
  });

  return rack.id;
}


// ============================================================
// GET NEAR-EXPIRY INVENTORY
//
// Default = within next 6 months, excluding already-expired.
// Example:
// GET /api/inventory/alerts/near-expiry?months=6
// ============================================================

export const getNearExpiryInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requestedMonths = Number.parseInt(
      String(req.query.months ?? "6"),
      10
    );

    const months = Math.min(
      24,
      Math.max(
        1,
        Number.isNaN(requestedMonths)
          ? 6
          : requestedMonths
      )
    );

    const now = new Date();

    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() + months);

    const inventory = await prisma.inventory.findMany({
      include: {
        generic: true,
        category: true,
        rack: true,
      },
      orderBy: {
        expiryDate: "asc",
      },
    });

    const data = inventory
      .filter((item) => {
        const expiry = new Date(item.expiryDate);

        if (Number.isNaN(expiry.getTime())) {
          return false;
        }

        return expiry > now && expiry <= cutoff;
      })
      .map(formatInventoryItem);

    res.status(200).json({
      success: true,
      months,
      count: data.length,
      from: now.toISOString(),
      until: cutoff.toISOString(),
      data,
    });
  } catch (error) {
    console.error(
      "Error fetching near-expiry inventory:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve near-expiry inventory.",
    });
  }
};


// ============================================================
// BULK IMPORT / BULK MERGE INVENTORY
//
// Accept:
// {
//   "mode": "merge",
//   "items": [ ... ]
// }
//
// OR:
// [ ... ]
//
// mode:
// merge   = add imported stock to existing stock
// replace = replace stock/details
// skip    = leave duplicate untouched
//
// Duplicate key:
// Medicine Brand + Batch Number
// ============================================================

export const bulkImportInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const rawItems = Array.isArray(req.body)
      ? req.body
      : req.body?.items;

    const requestedMode = Array.isArray(req.body)
      ? "merge"
      : String(req.body?.mode ?? "merge")
          .trim()
          .toLowerCase();

    const mode =
      requestedMode === "replace" ||
      requestedMode === "skip"
        ? requestedMode
        : "merge";

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({
        success: false,
        message:
          "Bulk import requires a non-empty 'items' array.",
      });
      return;
    }

    if (rawItems.length > 2000) {
      res.status(400).json({
        success: false,
        message:
          "A maximum of 2000 medicines can be imported per request.",
      });
      return;
    }

    const created: any[] = [];
    const updated: any[] = [];
    const skipped: any[] = [];
    const errors: {
      row: number;
      medicine?: string;
      batch?: string;
      reason: string;
    }[] = [];

    for (let index = 0; index < rawItems.length; index++) {
      const item: AnyRecord = rawItems[index] ?? {};

      const row = index + 1;

      const brand = cleanString(
        item.medicineBrand ??
        item.name
      );

      const batchNumber = cleanString(
        item.batchNumber
      );

      const expiryDate = cleanString(
        item.expiryDate
      );

      try {
        if (!brand) {
          throw new Error(
            "Medicine Brand Name is required."
          );
        }

        if (!batchNumber) {
          throw new Error(
            "Batch Number is required."
          );
        }

        if (!expiryDate) {
          throw new Error(
            "Expiry Date is required."
          );
        }

        const genericId =
          await resolveGeneric(item);

        const categoryId =
          await resolveCategory(item);

        const rackId =
          await resolveRack(item);

        const unitPerPack = toInt(
          item.unitPerPack ??
          item.unitsPerPack,
          10,
          1
        );

        const packInStock = toInt(
          item.packInStock ??
          item.stockPacks,
          0,
          0
        );

        const unitInStock = toInt(
          item.unitInStock ??
          item.stockLooseUnits,
          0,
          0
        );

        const packAlertLevel = toInt(
          item.packAlertLevel ??
          item.reorderLevel,
          15,
          0
        );

        const costPrice = toNumber(
          item.costPrice,
          0,
          0
        );

        const sellingPrice = toNumber(
          item.sellingPrice ??
          item.mrpPrice,
          0,
          0
        );

        const hasvat = toBoolean(
          item.hasvat ??
          item.isVatApplicable,
          false
        );

        const existing =
          await prisma.inventory.findFirst({
            where: {
              medicineBrand: {
                equals: brand,
                mode: "insensitive",
              },
              batchNumber: {
                equals: batchNumber,
                mode: "insensitive",
              },
            },
            include: {
              generic: true,
              category: true,
              rack: true,
            },
          });

        if (existing && mode === "skip") {
          skipped.push({
            row,
            id: existing.id,
            medicineBrand:
              existing.medicineBrand,
            batchNumber:
              existing.batchNumber,
            reason:
              "Duplicate medicine + batch skipped.",
          });

          continue;
        }

        if (existing) {
          const saved =
            await prisma.inventory.update({
              where: {
                id: existing.id,
              },
              data: {
                medicineBrand: brand,
                batchNumber,
                expiryDate,
                genericId,
                categoryId,
                rackId,
                unitPerPack,

                packInStock:
                  mode === "merge"
                    ? existing.packInStock +
                      packInStock
                    : packInStock,

                unitInStock:
                  mode === "merge"
                    ? existing.unitInStock +
                      unitInStock
                    : unitInStock,

                packAlertLevel,
                costPrice,
                sellingPrice,
                hasvat,
              },
              include: {
                generic: true,
                category: true,
                rack: true,
              },
            });

          updated.push(
            formatInventoryItem(saved)
          );

          continue;
        }

        const saved =
          await prisma.inventory.create({
            data: {
              medicineBrand: brand,
              batchNumber,
              expiryDate,
              genericId,
              categoryId,
              rackId,
              unitPerPack,
              packInStock,
              unitInStock,
              packAlertLevel,
              costPrice,
              sellingPrice,
              hasvat,
            },
            include: {
              generic: true,
              category: true,
              rack: true,
            },
          });

        created.push(
          formatInventoryItem(saved)
        );
      } catch (error) {
        errors.push({
          row,
          medicine: brand || undefined,
          batch: batchNumber || undefined,
          reason:
            error instanceof Error
              ? error.message
              : "Unknown import error.",
        });
      }
    }

    const processed =
      created.length +
      updated.length +
      skipped.length;

    res.status(
      errors.length > 0 && processed === 0
        ? 400
        : 200
    ).json({
      success:
        processed > 0 || errors.length === 0,

      message:
        `Bulk inventory import completed: ` +
        `${created.length} created, ` +
        `${updated.length} updated, ` +
        `${skipped.length} skipped, ` +
        `${errors.length} error(s).`,

      mode,

      summary: {
        received: rawItems.length,
        created: created.length,
        updated: updated.length,
        skipped: skipped.length,
        errors: errors.length,
      },

      data: {
        created,
        updated,
        skipped,
        errors,
      },
    });
  } catch (error) {
    console.error(
      "Bulk inventory import error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to process bulk inventory import.",
    });
  }
};
