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
            const finalBatch = hasBatch && rawBatch ? rawBatch : "BAT-DEFAULT";
            const finalExpiry = hasExpiry && cleanString(item.expiryDate)
              ? cleanString(item.expiryDate)
              : "2028-12-31";

            const unitPerPack = hasUnitsPerPack
              ? toInt(item.unitPerPack ?? item.unitsPerPack, 10, 1)
              : 10;

            const packInStock = hasStockPacks
              ? toInt(item.packInStock ?? item.stockPacks, 0, 0)
              : 0;

            const unitInStock = hasStockLoose
              ? toInt(item.unitInStock ?? item.stockLooseUnits, 0, 0)
              : 0;

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
                      existing.packInStock ||
                    unitInStock !==
                      existing.unitInStock
                  ) {
                    await tx.stockAdjustmentLog.create({
                      data: {
                        medicineId:
                          existing.id,

                        adjustmentType:
                          "CORRECTION",

                        previousPacks:
                          existing.packInStock,

                        newPacks:
                          packInStock,

                        variancePacks:
                          packInStock -
                          existing.packInStock,

                        previousLooseUnits:
                          existing.unitInStock,

                        newLooseUnits:
                          unitInStock,

                        varianceLooseUnits:
                          unitInStock -
                          existing.unitInStock,

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

          if (hasStockPacks) {
            const inputPacks = toInt(
              item.packInStock ?? item.stockPacks,
              0,
              0
            );
            updateData.packInStock = existing.packInStock + inputPacks;
          }

          if (hasStockLoose) {
            const inputLoose = toInt(
              item.unitInStock ?? item.stockLooseUnits,
              0,
              0
            );
            updateData.unitInStock = existing.unitInStock + inputLoose;
          }

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

          const nextPacks =
            updateData.packInStock ??
            existing.packInStock;

          const nextLooseUnits =
            updateData.unitInStock ??
            existing.unitInStock;

          const saved =
            await prisma.$transaction(
              async (tx) => {
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
                    existing.packInStock ||
                  nextLooseUnits !==
                    existing.unitInStock
                ) {
                  await tx.stockAdjustmentLog.create({
                    data: {
                      medicineId:
                        existing.id,

                      adjustmentType:
                        "CORRECTION",

                      previousPacks:
                        existing.packInStock,

                      newPacks:
                        nextPacks,

                      variancePacks:
                        nextPacks -
                        existing.packInStock,

                      previousLooseUnits:
                        existing.unitInStock,

                      newLooseUnits:
                        nextLooseUnits,

                      varianceLooseUnits:
                        nextLooseUnits -
                        existing.unitInStock,

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
        const finalBatch = hasBatch && rawBatch ? rawBatch : "BAT-DEFAULT";

        let finalExpiry = cleanString(item.expiryDate);
        if (!finalExpiry) {
          finalExpiry = "2028-12-31";
        }

        const unitPerPack = hasUnitsPerPack
          ? toInt(item.unitPerPack ?? item.unitsPerPack, 10, 1)
          : 10;

        const packInStock = hasStockPacks
          ? toInt(item.packInStock ?? item.stockPacks, 0, 0)
          : 0;

        const unitInStock = hasStockLoose
          ? toInt(item.unitInStock ?? item.stockLooseUnits, 0, 0)
          : 0;

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

        const saved = await prisma.inventory.create({
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
