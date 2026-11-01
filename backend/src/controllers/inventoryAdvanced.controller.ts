import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatInventoryItem } from "./inventory.controller.js";

type AnyRecord = Record<string, any>;

const cleanString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();


const isValidExpiryDate = (value: unknown): boolean => {
  const text = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const parsed = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === text
  );
};

const toInt = (
  value: unknown,
  fallback = 0,
  minimum = 0
): number => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`Expected a whole number greater than or equal to ${minimum}; received '${String(value)}'.`);
  }

  return parsed;
};

const toNumber = (
  value: unknown,
  fallback = 0,
  minimum = 0
): number => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`Expected a number greater than or equal to ${minimum}; received '${String(value)}'.`);
  }

  return parsed;
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

  if (["true", "1", "yes", "13%", "vat"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "vat free", "0%"].includes(normalized)) {
    return false;
  }

  throw new Error(`VAT applicability must be true/false; received '${String(value)}'.`);
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

  const rawGeneric = cleanString(
    item.genericName ??
    item.generic?.name ??
    item.generic
  );

  const brand = cleanString(item.medicineBrand ?? item.name);

  // If generic is not provided, empty, or literally the brand name, link to canonical "Unassigned" generic
  if (
    !rawGeneric ||
    rawGeneric.toLowerCase() === "unassigned" ||
    rawGeneric.toLowerCase() === "null" ||
    (brand && rawGeneric.toLowerCase() === brand.toLowerCase())
  ) {
    const unassigned = await prisma.generic.upsert({
      where: { name: "Unassigned" },
      update: {},
      create: { name: "Unassigned" },
    });
    return unassigned.id;
  }

  const generic = await prisma.generic.upsert({
    where: { name: rawGeneric },
    update: {},
    create: { name: rawGeneric },
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

async function resolveDistributor(
  item: AnyRecord
): Promise<number | null> {
  const rawDistId =
    item.distributorId ??
    item.supplierId ??
    item.distributor?.id;

  if (rawDistId !== undefined && rawDistId !== null) {
    const rawValue = String(rawDistId).trim().toLowerCase();

    if (
      rawValue === "null" ||
      rawValue === "unassigned" ||
      rawValue === ""
    ) {
      return null;
    }

    const match = String(rawDistId).match(/\d+/);

    if (match) {
      const id = Number.parseInt(match[0], 10);

      const existing = await prisma.distributor.findUnique({
        where: { id },
      });

      if (existing) {
        return existing.id;
      }
    }
  }

  const distName = cleanString(
    item.distributorName ??
    item.supplierName ??
    item.stockistName ??
    item.distributor ??
    item.supplier
  );

  if (
    !distName ||
    distName.toLowerCase() === "unassigned" ||
    distName.toLowerCase() === "none"
  ) {
    return null;
  }

  let dist = await prisma.distributor.findFirst({
    where: { name: { equals: distName, mode: "insensitive" } },
  });

  if (!dist) {
    dist = await prisma.distributor.create({
      data: {
        name: distName,
        phone: "9800000000",
        address: "Makwanpur, Nepal",
      },
    });
  }

  return dist.id;
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

    const authUser =
      (req as any).user ?? {};

    const recordedBy =
      String(
        authUser.username ??
        authUser.fullName ??
        authUser.userId ??
        authUser.id ??
        "authenticated-user"
      );

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

      const rawBatch = cleanString(
        item.batchNumber
      );

      try {
        if (!brand) {
          throw new Error(
            "Medicine Brand Name is required."
          );
        }

        const provided =
          typeof item.providedFields === "object" && item.providedFields !== null
            ? item.providedFields
            : null;

        const hasBatch = provided
          ? Boolean(provided.batchNumber)
          : Boolean(rawBatch);

        const hasExpiry = provided
          ? Boolean(provided.expiryDate)
          : Boolean(cleanString(item.expiryDate));

        // Batch and expiry are physical batch identity. Bulk import must never
        // invent either value or match an ambiguous brand-only row.
        if (!hasBatch || !rawBatch) {
          throw new Error("Batch Number is required; bulk import will not fabricate a batch.");
        }

        const strictExpiry = cleanString(item.expiryDate);
        if (!hasExpiry || !strictExpiry) {
          throw new Error("Expiry Date is required; bulk import will not fabricate an expiry date.");
        }
        if (!isValidExpiryDate(strictExpiry)) {
          throw new Error("Expiry Date must be a valid calendar date in YYYY-MM-DD format.");
        }

        const hasCostPrice = provided
          ? Boolean(provided.costPrice)
          : (item.costPrice !== undefined && item.costPrice !== null && item.costPrice !== "");

        const hasSellingPrice = provided
          ? Boolean(provided.mrpPrice ?? provided.sellingPrice)
          : ((item.sellingPrice ?? item.mrpPrice) !== undefined &&
             (item.sellingPrice ?? item.mrpPrice) !== null &&
             (item.sellingPrice ?? item.mrpPrice) !== "");

        const hasStockPacks = provided
          ? Boolean(provided.stockPacks ?? provided.packInStock)
          : ((item.packInStock ?? item.stockPacks) !== undefined &&
             (item.packInStock ?? item.stockPacks) !== null &&
             (item.packInStock ?? item.stockPacks) !== "");

        const hasStockLoose = provided
          ? Boolean(provided.stockLooseUnits ?? provided.unitInStock)
          : ((item.unitInStock ?? item.stockLooseUnits) !== undefined &&
             (item.unitInStock ?? item.stockLooseUnits) !== null &&
             (item.unitInStock ?? item.stockLooseUnits) !== "");

        const hasUnitsPerPack = provided
          ? Boolean(provided.unitsPerPack ?? provided.unitPerPack)
          : ((item.unitPerPack ?? item.unitsPerPack) !== undefined &&
             (item.unitPerPack ?? item.unitsPerPack) !== null &&
             (item.unitPerPack ?? item.unitsPerPack) !== "");

        const hasGeneric = provided
          ? Boolean(provided.genericName)
          : Boolean(cleanString(item.genericName ?? item.generic?.name ?? item.generic));

        const hasCategory = provided
          ? Boolean(provided.category)
          : Boolean(cleanString(item.category ?? item.categoryName ?? item.categoryDetails?.name));

        const hasRack = provided
          ? Boolean(provided.rackLocation)
          : Boolean(cleanString(item.rackLocation ?? item.rack?.name ?? item.rack));

        const hasVat = provided
          ? Boolean(provided.isVatApplicable)
          : (item.hasvat !== undefined || item.isVatApplicable !== undefined);

        const hasBarcode = provided
          ? Boolean(provided.barcode)
          : Boolean(cleanString(item.barcode));

        const hasNotes = provided
          ? Boolean(provided.notes)
          : Boolean(cleanString(item.notes));

        const hasDistributor = provided
          ? Boolean(provided.distributorId ?? provided.distributorName ?? provided.supplierId ?? provided.supplierName)
          : (item.distributorId !== undefined ||
             item.supplierId !== undefined ||
             Boolean(cleanString(item.distributorName ?? item.supplierName ?? item.stockistName ?? item.distributor ?? item.supplier)));

        const targetDistId = hasDistributor ? await resolveDistributor(item) : null;
        const distFilter = targetDistId !== null
          ? { OR: [{ distributorId: targetDistId }, { distributorId: null }] }
          : {};

        // 1. Try to match existing medicine by brand + batch + expiry (+ distributor if specified)
        let existing = null;
        const cleanExpiry = hasExpiry ? cleanString(item.expiryDate) : null;
        if (hasBatch && rawBatch) {
          existing = await prisma.inventory.findFirst({
            where: {
              medicineBrand: {
                equals: brand,
                mode: "insensitive",
              },
              batchNumber: {
                equals: rawBatch,
                mode: "insensitive",
              },
              ...(cleanExpiry ? {
                expiryDate: {
                  equals: cleanExpiry,
                  mode: "insensitive",
                },
              } : {}),
              ...distFilter,
            },
            include: {
              generic: true,
              category: true,
              rack: true,
              distributor: true,
            },
          });
        }

        // 2. If no match by batch or batch was not specified in the sheet, match by brand name + expiry (+ distributor if specified)
        if (!existing && (!hasBatch || !rawBatch)) {
          existing = await prisma.inventory.findFirst({
            where: {
              medicineBrand: {
                equals: brand,
                mode: "insensitive",
              },
              ...(cleanExpiry ? {
                expiryDate: {
                  equals: cleanExpiry,
                  mode: "insensitive",
                },
              } : {}),
              ...distFilter,
            },
            orderBy: { id: "desc" },
            include: {
              generic: true,
              category: true,
              rack: true,
              distributor: true,
            },
          });
        }

        // Handle skip mode
        if (existing && mode === "skip") {
          skipped.push({
            row,
            id: existing.id,
            medicineBrand:
              existing.medicineBrand,
            batchNumber:
              existing.batchNumber,
            reason:
              "Duplicate medicine record skipped.",
          });

          continue;
        }

        // Handle update (replace or merge mode)
        if (existing) {
          if (mode === "replace") {
            // Replace Mode: Fully overwrite record with the uploaded row data.
            // Omitted fields are reset to clean defaults so old data (generic, rack, etc.) is not left behind.
            let genericId: number;
            if (hasGeneric && cleanString(item.genericName)) {
              genericId = await resolveGeneric(item);
            } else {
              const unassigned = await prisma.generic.upsert({
                where: { name: "Unassigned" },
                update: {},
                create: { name: "Unassigned" },
              });
              genericId = unassigned.id;
            }

            let categoryId: number;
            if (hasCategory) {
              categoryId = await resolveCategory(item);
            } else {
              const cat = await prisma.category.upsert({
                where: { name: "Tablet" },
                update: {},
                create: { name: "Tablet" },
              });
              categoryId = cat.id;
            }

            // If rack is not in the uploaded sheet, clear old rack (set null / unassigned)
            const rackId = hasRack ? await resolveRack(item) : null;
            const finalBatch = rawBatch;
            const finalExpiry = strictExpiry;

            const unitPerPack = hasUnitsPerPack
              ? toInt(item.unitPerPack ?? item.unitsPerPack, 10, 1)
              : 10;

            const packInStock = hasStockPacks
              ? toInt(item.packInStock ?? item.stockPacks, 0, 0)
              : 0;

            const unitInStock = hasStockLoose
              ? toInt(item.unitInStock ?? item.stockLooseUnits, 0, 0)
              : 0;

            if (unitInStock >= unitPerPack) {
              throw new Error(
                `Loose-unit stock must be less than units per pack (${unitPerPack}); convert full units into packs.`
              );
            }

            const packAlertLevel = (item.packAlertLevel !== undefined || item.reorderLevel !== undefined)
              ? toInt(item.packAlertLevel ?? item.reorderLevel, 15, 0)
              : 15;

            const sellingPrice = hasSellingPrice
              ? toNumber(item.sellingPrice ?? item.mrpPrice, 0, 0)
              : 0;

            const costPrice = hasCostPrice
              ? toNumber(item.costPrice, 0, 0)
              : (sellingPrice > 0 ? Math.round(sellingPrice * 0.75 * 100) / 100 : 0);

            const hasvat = hasVat
              ? toBoolean(item.hasvat ?? item.isVatApplicable, false)
              : false;

            const barcode = hasBarcode ? cleanString(item.barcode) || null : null;
            const notes = hasNotes ? cleanString(item.notes) || null : null;
            const distributorId = targetDistId;

            const saved =
              await prisma.$transaction(
                async (tx) => {
                  await tx.$queryRaw`
                    SELECT id
                      FROM inventory_tbl
                     WHERE id = ${existing.id}
                     FOR UPDATE
                  `;

                  const current = await tx.inventory.findUnique({
                    where: { id: existing.id },
                  });
                  if (!current) {
                    throw new Error("Inventory row no longer exists.");
                  }
                  if (
                    current.packInStock !== existing.packInStock ||
                    current.unitInStock !== existing.unitInStock
                  ) {
                    throw new Error(
                      "Inventory stock changed while REPLACE import was being prepared. Retry the import so a concurrent sale/adjustment is not overwritten."
                    );
                  }

                  const inventory =
                    await tx.inventory.update({
                      where: {
                        id:
                          existing.id,
                      },

                      data: {
                        medicineBrand:
                          brand,

                        batchNumber:
                          finalBatch,

                        expiryDate:
                          finalExpiry,

                        genericId,
                        categoryId,
                        rackId,
                        distributorId,
                        unitPerPack,

                        packInStock,
                        unitInStock,

                        packAlertLevel,
                        costPrice,
                        sellingPrice,
                        hasvat,
                        barcode,
                        notes,
                      },

                      include: {
                        generic: true,
                        category: true,
                        rack: true,
                        distributor: true,
                      },
                    });

                  if (
                    packInStock !==
                      current.packInStock ||
                    unitInStock !==
                      current.unitInStock
                  ) {
                    await tx.stockAdjustmentLog.create({
                      data: {
                        medicineId:
                          existing.id,

                        adjustmentType:
                          "CORRECTION",

                        previousPacks:
                          current.packInStock,

                        newPacks:
                          packInStock,

                        variancePacks:
                          packInStock -
                          current.packInStock,

                        previousLooseUnits:
                          current.unitInStock,

                        newLooseUnits:
                          unitInStock,

                        varianceLooseUnits:
                          unitInStock -
                          current.unitInStock,

                        reason:
                          `Bulk inventory import REPLACE mode, row ${row}.`,

                        recordedBy,
                      },
                    });
                  }

                  return inventory;
                }
              );

            updated.push(
              formatInventoryItem(saved)
            );

            continue;
          }

          // Merge Mode: Update provided fields and add stock, preserving existing unmentioned fields
          const updateData: any = {
            medicineBrand: brand,
          };

          if (hasBatch && rawBatch) {
            updateData.batchNumber = rawBatch;
          }

          const cleanExpiry = cleanString(item.expiryDate);
          if (hasExpiry && cleanExpiry) {
            updateData.expiryDate = cleanExpiry;
          }

          if (hasGeneric) {
            try {
              const genericId = await resolveGeneric(item);
              if (genericId) updateData.genericId = genericId;
            } catch {
              // Preserve existing generic on error
            }
          }

          if (hasCategory) {
            try {
              const categoryId = await resolveCategory(item);
              if (categoryId) updateData.categoryId = categoryId;
            } catch {
              // Preserve existing category on error
            }
          }

          if (hasRack) {
            try {
              const rackId = await resolveRack(item);
              updateData.rackId = rackId;
            } catch {
              // Preserve existing rack on error
            }
          }

          if (hasUnitsPerPack) {
            updateData.unitPerPack = toInt(
              item.unitPerPack ?? item.unitsPerPack,
              existing.unitPerPack,
              1
            );
          }

          const inputPacksToAdd = hasStockPacks
            ? toInt(item.packInStock ?? item.stockPacks, 0, 0)
            : 0;
          const inputLooseToAdd = hasStockLoose
            ? toInt(item.unitInStock ?? item.stockLooseUnits, 0, 0)
            : 0;

          if (item.packAlertLevel !== undefined || item.reorderLevel !== undefined) {
            updateData.packAlertLevel = toInt(
              item.packAlertLevel ?? item.reorderLevel,
              existing.packAlertLevel,
              0
            );
          }

          if (hasCostPrice) {
            updateData.costPrice = toNumber(
              item.costPrice,
              Number(existing.costPrice),
              0
            );
          }

          if (hasSellingPrice) {
            updateData.sellingPrice = toNumber(
              item.sellingPrice ?? item.mrpPrice,
              Number(existing.sellingPrice),
              0
            );
          }

          if (hasVat) {
            updateData.hasvat = toBoolean(
              item.hasvat ?? item.isVatApplicable,
              existing.hasvat
            );
          }

          if (hasBarcode) {
            updateData.barcode = cleanString(item.barcode) || null;
          }

          if (hasNotes) {
            updateData.notes = cleanString(item.notes) || null;
          }

          if (hasDistributor) {
            updateData.distributorId = targetDistId;
          }

          const saved =
            await prisma.$transaction(
              async (tx) => {
                await tx.$queryRaw`
                  SELECT id
                    FROM inventory_tbl
                   WHERE id = ${existing.id}
                   FOR UPDATE
                `;

                const current = await tx.inventory.findUnique({
                  where: { id: existing.id },
                });
                if (!current) {
                  throw new Error("Inventory row no longer exists.");
                }

                const targetUnitsPerPack = Number(
                  updateData.unitPerPack ?? current.unitPerPack
                );
                if (
                  targetUnitsPerPack !== current.unitPerPack &&
                  (current.packInStock > 0 || current.unitInStock > 0)
                ) {
                  throw new Error(
                    "Units per pack cannot be changed by MERGE import while physical stock exists. Normalize stock first."
                  );
                }

                const addedUnits =
                  inputPacksToAdd * targetUnitsPerPack + inputLooseToAdd;
                const currentUnits =
                  current.packInStock * targetUnitsPerPack + current.unitInStock;
                const mergedUnits = currentUnits + addedUnits;
                const nextPacks = Math.floor(mergedUnits / targetUnitsPerPack);
                const nextLooseUnits = mergedUnits % targetUnitsPerPack;

                if (hasStockPacks || hasStockLoose) {
                  updateData.packInStock = nextPacks;
                  updateData.unitInStock = nextLooseUnits;
                }

                const inventory =
                  await tx.inventory.update({
                    where: {
                      id:
                        existing.id,
                    },

                    data:
                      updateData,

                    include: {
                      generic: true,
                      category: true,
                      rack: true,
                      distributor: true,
                    },
                  });

                if (
                  nextPacks !==
                    current.packInStock ||
                  nextLooseUnits !==
                    current.unitInStock
                ) {
                  await tx.stockAdjustmentLog.create({
                    data: {
                      medicineId:
                        existing.id,

                      adjustmentType:
                        "CORRECTION",

                      previousPacks:
                        current.packInStock,

                      newPacks:
                        nextPacks,

                      variancePacks:
                        nextPacks -
                        current.packInStock,

                      previousLooseUnits:
                        current.unitInStock,

                      newLooseUnits:
                        nextLooseUnits,

                      varianceLooseUnits:
                        nextLooseUnits -
                        current.unitInStock,

                      reason:
                        `Bulk inventory import MERGE mode, row ${row}.`,

                      recordedBy,
                    },
                  });
                }

                return inventory;
              }
            );

          updated.push(
            formatInventoryItem(saved)
          );

          continue;
        }

        // New item creation (sensible defaults for fields omitted from Excel)
        let genericId: number;
        if (hasGeneric && cleanString(item.genericName)) {
          genericId = await resolveGeneric(item);
        } else {
          const unassigned = await prisma.generic.upsert({
            where: { name: "Unassigned" },
            update: {},
            create: { name: "Unassigned" },
          });
          genericId = unassigned.id;
        }

        let categoryId: number;
        if (hasCategory) {
          categoryId = await resolveCategory(item);
        } else {
          const cat = await prisma.category.upsert({
            where: { name: "Tablet" },
            update: {},
            create: { name: "Tablet" },
          });
          categoryId = cat.id;
        }

        const rackId = hasRack ? await resolveRack(item) : null;
        const finalBatch = rawBatch;
        const finalExpiry = strictExpiry;

        const unitPerPack = hasUnitsPerPack
          ? toInt(item.unitPerPack ?? item.unitsPerPack, 10, 1)
          : 10;

        const packInStock = hasStockPacks
          ? toInt(item.packInStock ?? item.stockPacks, 0, 0)
          : 0;

        const unitInStock = hasStockLoose
          ? toInt(item.unitInStock ?? item.stockLooseUnits, 0, 0)
          : 0;

        if (unitInStock >= unitPerPack) {
          throw new Error(
            `Loose-unit stock must be less than units per pack (${unitPerPack}); convert full units into packs.`
          );
        }

        const packAlertLevel = (item.packAlertLevel !== undefined || item.reorderLevel !== undefined)
          ? toInt(item.packAlertLevel ?? item.reorderLevel, 15, 0)
          : 15;

        const sellingPrice = hasSellingPrice
          ? toNumber(item.sellingPrice ?? item.mrpPrice, 0, 0)
          : 0;

        const costPrice = hasCostPrice
          ? toNumber(item.costPrice, 0, 0)
          : (sellingPrice > 0 ? Math.round(sellingPrice * 0.75 * 100) / 100 : 0);

        const hasvat = hasVat
          ? toBoolean(item.hasvat ?? item.isVatApplicable, false)
          : false;

        const barcode = hasBarcode ? cleanString(item.barcode) || null : null;
        const notes = hasNotes ? cleanString(item.notes) || null : null;
        const distributorId = targetDistId;

        const saved = await prisma.$transaction(async (tx) => {
          const batchLockKey =
            `inventory-batch:${brand.toLowerCase()}|${finalBatch.toLowerCase()}`;
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtext(${batchLockKey}))
          `;

          const duplicate = await tx.inventory.findFirst({
            where: {
              medicineBrand: { equals: brand, mode: "insensitive" },
              batchNumber: { equals: finalBatch, mode: "insensitive" },
            },
            select: { id: true, expiryDate: true },
          });
          if (duplicate) {
            throw new Error(
              `Medicine '${brand}' batch '${finalBatch}' already exists (inventory ID ${duplicate.id}, expiry ${duplicate.expiryDate}).`
            );
          }

          return tx.inventory.create({
            data: {
              medicineBrand: brand,
              batchNumber: finalBatch,
              expiryDate: finalExpiry,
              genericId,
              categoryId,
              rackId,
              distributorId,
              unitPerPack,
              packInStock,
              unitInStock,
              packAlertLevel,
              costPrice,
              sellingPrice,
              hasvat,
              barcode,
              notes,
            },
            include: {
              generic: true,
              category: true,
              rack: true,
              distributor: true,
            },
          });
        });

        created.push(
          formatInventoryItem(saved)
        );
      } catch (error) {
        errors.push({
          row,
          medicine: brand || undefined,
          batch: rawBatch || undefined,
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
