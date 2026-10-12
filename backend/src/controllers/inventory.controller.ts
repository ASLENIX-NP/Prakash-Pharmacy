import { Request, Response } from "express";
import { prisma } from "../db.js";
import {
  formatMedicineCode,
  formatRackCode,
  formatCategoryCode,
  formatGenericCode,
  parseIdParam,
} from "../utils/id.helpers.js";

// Helper to format inventory database record into rich response
export const formatInventoryItem = (inv: any) => {
  const medicineCode = formatMedicineCode(inv.id);
  return {
    id: medicineCode, // Formatted ID e.g. "MED-001"
    medicineCode,
    medicineBrand: inv.medicineBrand,
    name: inv.medicineBrand, // friendly alias
    generic: {
      id: formatGenericCode(inv.generic.id), // "GEN-001"
      genericCode: formatGenericCode(inv.generic.id),
      name: inv.generic.name,
    },
    genericName: inv.generic.name,
    category: inv.category.name, // "Tablet", "Capsule" (matches frontend MedicineCategory)
    categoryName: inv.category.name,
    categoryDetails: {
      id: formatCategoryCode(inv.category.id), // "CAT-001"
      categoryCode: formatCategoryCode(inv.category.id),
      name: inv.category.name,
    },
    rack: inv.rack
      ? {
          id: formatRackCode(inv.rack.id), // "RCK-001"
          rackCode: formatRackCode(inv.rack.id),
          name: inv.rack.name,
          description: inv.rack.description ?? "",
        }
      : null,
    rackLocation: inv.rack ? inv.rack.name : "Unassigned",
    batchNumber: inv.batchNumber,
    expiryDate: inv.expiryDate,
    unitPerPack: inv.unitPerPack,
    unitsPerPack: inv.unitPerPack, // Frontend compatibility alias
    packInStock: inv.packInStock,
    stockPacks: inv.packInStock, // Frontend compatibility alias
    unitInStock: inv.unitInStock,
    stockLooseUnits: inv.unitInStock, // Frontend compatibility alias
    totalUnitsAvailable: inv.packInStock * inv.unitPerPack + inv.unitInStock,
    packAlertLevel: inv.packAlertLevel,
    reorderLevel: inv.packAlertLevel, // Frontend compatibility alias
    costPrice: Number(inv.costPrice),
    sellingPrice: Number(inv.sellingPrice),
    mrpPrice: Number(inv.sellingPrice), // friendly alias
    hasvat: inv.hasvat,
    isVatApplicable: inv.hasvat, // friendly alias
    isLowStock: inv.packInStock <= inv.packAlertLevel,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
};

// ==========================================
// 1. GET ALL INVENTORY / MEDICINES
// Supports: ?search= & ?categoryId= & ?rackId= & ?lowStock=true & ?hasvat=true & pagination
// ==========================================
export const getAllInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      categoryId,
      rackId,
      hasvat,
      lowStock,
      page = "1",
      limit = "50",
      sortBy = "medicineBrand",
      sortOrder = "asc",
    } = req.query;

    const where: any = {};

    // 1. Search Query across brand, generic name, or batch
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { medicineBrand: { contains: q, mode: "insensitive" } },
        { batchNumber: { contains: q, mode: "insensitive" } },
        { generic: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // 2. Filter by Category
    if (categoryId) {
      const parsedCat = parseInt(String(categoryId), 10);
      if (!isNaN(parsedCat)) {
        where.categoryId = parsedCat;
      }
    }

    // 3. Filter by Rack
    if (rackId) {
      if (rackId === "unassigned" || rackId === "null") {
        where.rackId = null;
      } else {
        const parsedRack = parseInt(String(rackId), 10);
        if (!isNaN(parsedRack)) {
          where.rackId = parsedRack;
        }
      }
    }

    // 4. Filter by VAT flag
    if (hasvat !== undefined) {
      if (hasvat === "true") where.hasvat = true;
      if (hasvat === "false") where.hasvat = false;
    }

    // 5. Filter by Low Stock
    // Note: If lowStock is true, we filter in memory or via raw query, or prisma filter
    // Prisma doesn't directly support column-to-column comparison (packInStock <= packAlertLevel)
    // in standard findMany without raw SQL, so we fetch and filter if requested or handle pagination.
    const isLowStockRequested = lowStock === "true";

    // Ordering
    const orderDirection = sortOrder === "desc" ? "desc" : "asc";
    const orderBy: any = {};
    if (sortBy === "expiryDate" || sortBy === "packInStock" || sortBy === "sellingPrice" || sortBy === "costPrice") {
      orderBy[sortBy] = orderDirection;
    } else {
      orderBy.medicineBrand = orderDirection;
    }

    const isAll = limit === "all";
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = isAll ? undefined : Math.max(1, parseInt(String(limit), 10) || 50);

    const [totalCount, rawItems] = await Promise.all([
      prisma.inventory.count({ where }),
      prisma.inventory.findMany({
        where,
        include: {
          generic: true,
          category: true,
          rack: true,
        },
        orderBy,
        skip: isAll || isLowStockRequested ? undefined : (parsedPage - 1) * (parsedLimit || 50),
        take: isAll || isLowStockRequested ? undefined : parsedLimit,
      }),
    ]);

    let formatted = rawItems.map(formatInventoryItem);

    // Apply low stock filter if requested
    if (isLowStockRequested) {
      formatted = formatted.filter((item) => item.isLowStock);
    }

    // If lowStock was requested with pagination, slice here
    const finalTotal = isLowStockRequested ? formatted.length : totalCount;
    const finalItems = isLowStockRequested && !isAll
      ? formatted.slice((parsedPage - 1) * (parsedLimit || 50), parsedPage * (parsedLimit || 50))
      : formatted;

    res.status(200).json({
      success: true,
      totalCount: finalTotal,
      page: parsedPage,
      limit: isAll ? "all" : parsedLimit,
      totalPages: isAll ? 1 : Math.ceil(finalTotal / (parsedLimit || 50)),
      count: finalItems.length,
      data: finalItems,
    });
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory items",
    });
  }
};

// ==========================================
// 2. GET INVENTORY ITEM BY ID
// ==========================================
export const getInventoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid medicine ID or code. Format should be 'MED-001' or a valid number.",
      });
      return;
    }

    const item = await prisma.inventory.findUnique({
      where: { id },
      include: {
        generic: true,
        category: true,
        rack: true,
      },
    });

    if (!item) {
      res.status(404).json({
        success: false,
        message: `Inventory item with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatInventoryItem(item),
    });
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory item",
    });
  }
};

// ==========================================
// 3. CREATE NEW INVENTORY / MEDICINE
// ==========================================
export const createInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      medicineBrand,
      name, // alias for brand
      batchNumber,
      expiryDate,
      genericId,
      genericName,
      categoryId,
      categoryName,
      category, // alias for categoryName
      rackId,
      rackLocation,
      rackName,
      unitPerPack,
      unitsPerPack, // alias
      packInStock,
      stockPacks, // alias
      unitInStock,
      stockLooseUnits, // alias
      packAlertLevel,
      reorderLevel, // alias
      costPrice,
      sellingPrice,
      mrpPrice, // alias
      hasvat,
      isVatApplicable, // alias
    } = req.body;

    const brand = (medicineBrand || name)?.trim();
    const batch = batchNumber?.trim();
    const expiry = expiryDate?.trim();

    if (!brand) {
      res.status(400).json({
        success: false,
        message: "Medicine brand name is required (e.g. 'Augmentin 625 Duo')",
      });
      return;
    }

    if (!batch) {
      res.status(400).json({
        success: false,
        message: "Batch number is required (e.g. 'AUG2024-01')",
      });
      return;
    }

    if (!expiry) {
      res.status(400).json({
        success: false,
        message: "Expiry date is required (e.g. '2027-06-30')",
      });
      return;
    }

    // 1. Resolve Generic ID
    let finalGenericId: number;
    if (genericId && !isNaN(parseInt(genericId, 10))) {
      finalGenericId = parseInt(genericId, 10);
      const exists = await prisma.generic.findUnique({ where: { id: finalGenericId } });
      if (!exists) {
        res.status(400).json({ success: false, message: `Generic with ID ${finalGenericId} not found` });
        return;
      }
    } else if (genericName && String(genericName).trim()) {
      const gName = String(genericName).trim();
      const genericRecord = await prisma.generic.upsert({
        where: { name: gName },
        update: {},
        create: { name: gName },
      });
      finalGenericId = genericRecord.id;
    } else {
      res.status(400).json({
        success: false,
        message: "Generic composition is required (provide genericId or genericName)",
      });
      return;
    }

    // 2. Resolve Category ID
    let finalCategoryId: number;
    const catNameInput = categoryName || category;
    if (categoryId && !isNaN(parseInt(categoryId, 10))) {
      finalCategoryId = parseInt(categoryId, 10);
      const exists = await prisma.category.findUnique({ where: { id: finalCategoryId } });
      if (!exists) {
        res.status(400).json({ success: false, message: `Category with ID ${finalCategoryId} not found` });
        return;
      }
    } else if (catNameInput && String(catNameInput).trim()) {
      const cName = String(catNameInput).trim();
      const catRecord = await prisma.category.upsert({
        where: { name: cName },
        update: {},
        create: { name: cName },
      });
      finalCategoryId = catRecord.id;
    } else {
      // Default to "Tablet" if not specified
      const defaultCat = await prisma.category.upsert({
        where: { name: "Tablet" },
        update: {},
        create: { name: "Tablet" },
      });
      finalCategoryId = defaultCat.id;
    }

    // 3. Resolve Rack ID (Optional)
    let finalRackId: number | null = null;
    const rackInput = rackName || rackLocation;
    if (rackId && !isNaN(parseInt(rackId, 10))) {
      finalRackId = parseInt(rackId, 10);
      const exists = await prisma.rack.findUnique({ where: { id: finalRackId } });
      if (!exists) finalRackId = null;
    } else if (rackInput && String(rackInput).trim() && String(rackInput).toLowerCase() !== "unassigned") {
      const rName = String(rackInput).trim();
      const rackRecord = await prisma.rack.upsert({
        where: { name: rName },
        update: {},
        create: { name: rName },
      });
      finalRackId = rackRecord.id;
    }

    // 4. Numerical and Pricing defaults
    const finalUnitPerPack = parseInt(String(unitPerPack ?? unitsPerPack ?? 10), 10) || 10;
    const finalPackInStock = parseInt(String(packInStock ?? stockPacks ?? 0), 10) || 0;
    const finalUnitInStock = parseInt(String(unitInStock ?? stockLooseUnits ?? 0), 10) || 0;
    const finalAlertLevel = parseInt(String(packAlertLevel ?? reorderLevel ?? 15), 10) || 15;
    const finalCostPrice = parseFloat(String(costPrice ?? 0)) || 0;
    const finalSellingPrice = parseFloat(String(sellingPrice ?? mrpPrice ?? 0)) || 0;
    const finalHasVat = Boolean(hasvat ?? isVatApplicable ?? false);

    const created = await prisma.inventory.create({
      data: {
        medicineBrand: brand,
        batchNumber: batch,
        expiryDate: expiry,
        genericId: finalGenericId,
        categoryId: finalCategoryId,
        rackId: finalRackId,
        unitPerPack: Math.max(1, finalUnitPerPack),
        packInStock: Math.max(0, finalPackInStock),
        unitInStock: Math.max(0, finalUnitInStock),
        packAlertLevel: Math.max(0, finalAlertLevel),
        costPrice: finalCostPrice,
        sellingPrice: finalSellingPrice,
        hasvat: finalHasVat,
      },
      include: {
        generic: true,
        category: true,
        rack: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Medicine '${created.medicineBrand}' added to inventory successfully`,
      data: formatInventoryItem(created),
    });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add medicine to inventory",
    });
  }
};

// ==========================================
// 4. UPDATE INVENTORY / MEDICINE
// ==========================================
export const updateInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid medicine ID or code. Format should be 'MED-001' or a valid number.",
      });
      return;
    }

    const existing = await prisma.inventory.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Inventory item with ID ${id} not found`,
      });
      return;
    }

    const {
      medicineBrand,
      name,
      batchNumber,
      expiryDate,
      genericId,
      genericName,
      categoryId,
      categoryName,
      category,
      rackId,
      rackLocation,
      rackName,
      unitPerPack,
      unitsPerPack,
      packInStock,
      stockPacks,
      unitInStock,
      stockLooseUnits,
      packAlertLevel,
      reorderLevel,
      costPrice,
      sellingPrice,
      mrpPrice,
      hasvat,
      isVatApplicable,
    } = req.body;

    const updateData: any = {};

    if (medicineBrand !== undefined || name !== undefined) {
      const b = (medicineBrand || name)?.trim();
      if (b) updateData.medicineBrand = b;
    }

    if (batchNumber !== undefined) {
      updateData.batchNumber = String(batchNumber).trim();
    }

    if (expiryDate !== undefined) {
      updateData.expiryDate = String(expiryDate).trim();
    }

    // Resolve Generic if provided
    if (genericId !== undefined && !isNaN(parseInt(genericId, 10))) {
      updateData.genericId = parseInt(genericId, 10);
    } else if (genericName && String(genericName).trim()) {
      const gRecord = await prisma.generic.upsert({
        where: { name: String(genericName).trim() },
        update: {},
        create: { name: String(genericName).trim() },
      });
      updateData.genericId = gRecord.id;
    }

    // Resolve Category if provided
    const catInput = categoryName || category;
    if (categoryId !== undefined && !isNaN(parseInt(categoryId, 10))) {
      updateData.categoryId = parseInt(categoryId, 10);
    } else if (catInput && String(catInput).trim()) {
      const cRecord = await prisma.category.upsert({
        where: { name: String(catInput).trim() },
        update: {},
        create: { name: String(catInput).trim() },
      });
      updateData.categoryId = cRecord.id;
    }

    // Resolve Rack if provided
    const rInput = rackName || rackLocation;
    if (rackId !== undefined) {
      if (rackId === null || rackId === "null" || rackId === "unassigned") {
        updateData.rackId = null;
      } else {
        const parsed = parseInt(String(rackId), 10);
        if (!isNaN(parsed)) updateData.rackId = parsed;
      }
    } else if (rInput !== undefined) {
      if (rInput === null || String(rInput).toLowerCase() === "unassigned") {
        updateData.rackId = null;
      } else {
        const rRecord = await prisma.rack.upsert({
          where: { name: String(rInput).trim() },
          update: {},
          create: { name: String(rInput).trim() },
        });
        updateData.rackId = rRecord.id;
      }
    }

    // Stock & Pricing fields
    if (unitPerPack !== undefined || unitsPerPack !== undefined) {
      const val = parseInt(String(unitPerPack ?? unitsPerPack), 10);
      if (!isNaN(val) && val > 0) updateData.unitPerPack = val;
    }

    if (packInStock !== undefined || stockPacks !== undefined) {
      const val = parseInt(String(packInStock ?? stockPacks), 10);
      if (!isNaN(val)) updateData.packInStock = Math.max(0, val);
    }

    if (unitInStock !== undefined || stockLooseUnits !== undefined) {
      const val = parseInt(String(unitInStock ?? stockLooseUnits), 10);
      if (!isNaN(val)) updateData.unitInStock = Math.max(0, val);
    }

    if (packAlertLevel !== undefined || reorderLevel !== undefined) {
      const val = parseInt(String(packAlertLevel ?? reorderLevel), 10);
      if (!isNaN(val)) updateData.packAlertLevel = Math.max(0, val);
    }

    if (costPrice !== undefined) {
      const val = parseFloat(String(costPrice));
      if (!isNaN(val)) updateData.costPrice = val;
    }

    if (sellingPrice !== undefined || mrpPrice !== undefined) {
      const val = parseFloat(String(sellingPrice ?? mrpPrice));
      if (!isNaN(val)) updateData.sellingPrice = val;
    }

    if (hasvat !== undefined || isVatApplicable !== undefined) {
      updateData.hasvat = Boolean(hasvat ?? isVatApplicable);
    }

    const updated = await prisma.inventory.update({
      where: { id },
      data: updateData,
      include: {
        generic: true,
        category: true,
        rack: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `Medicine '${updated.medicineBrand}' updated successfully`,
      data: formatInventoryItem(updated),
    });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
    });
  }
};

// ==========================================
// 5. DELETE INVENTORY / MEDICINE (Admin only)
// ==========================================
export const deleteInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        message: "Invalid medicine ID or code. Format should be 'MED-001' or a valid number.",
      });
      return;
    }

    const existing = await prisma.inventory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { billItems: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `Inventory item with ID ${id} not found`,
      });
      return;
    }

    if (existing._count.billItems > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete '${existing.medicineBrand}' because it is linked to ${existing._count.billItems} historical sales bill(s). Consider setting stock to 0 instead.`,
      });
      return;
    }

    await prisma.inventory.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: `Medicine '${existing.medicineBrand}' (Batch: ${existing.batchNumber}) deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory item",
    });
  }
};

// ==========================================
// 6. GET INVENTORY SUMMARY & ALERTS
// ==========================================
export const getInventorySummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const allItems = await prisma.inventory.findMany({
      select: {
        id: true,
        packInStock: true,
        unitInStock: true,
        unitPerPack: true,
        packAlertLevel: true,
        costPrice: true,
        sellingPrice: true,
        expiryDate: true,
      },
    });

    const now = new Date();
    const threeMonthsAhead = new Date();
    threeMonthsAhead.setMonth(now.getMonth() + 3);

    let totalPacks = 0;
    let totalLoose = 0;
    let lowStockCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    for (const item of allItems) {
      const packs = item.packInStock;
      const loose = item.unitInStock;
      const cost = Number(item.costPrice);
      const selling = Number(item.sellingPrice);

      totalPacks += packs;
      totalLoose += loose;

      // Low stock check
      if (packs <= item.packAlertLevel) {
        lowStockCount++;
      }

      // Expiry check
      if (item.expiryDate) {
        const expDate = new Date(item.expiryDate);
        if (!isNaN(expDate.getTime())) {
          if (expDate <= now) {
            expiredCount++;
          } else if (expDate <= threeMonthsAhead) {
            nearExpiryCount++;
          }
        }
      }

      // Valuations
      totalCostValuation += packs * cost;
      totalRetailValuation += packs * selling;
    }

    res.status(200).json({
      success: true,
      data: {
        totalMedicinesCount: allItems.length,
        totalStockPacks: totalPacks,
        totalStockLooseUnits: totalLoose,
        lowStockAlertCount: lowStockCount,
        nearExpiryAlertCount: nearExpiryCount,
        expiredCount,
        totalCostValuationNPR: Math.round(totalCostValuation * 100) / 100,
        totalRetailValuationNPR: Math.round(totalRetailValuation * 100) / 100,
        potentialProfitNPR: Math.round((totalRetailValuation - totalCostValuation) * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error generating inventory summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate inventory summary metrics",
    });
  }
};
