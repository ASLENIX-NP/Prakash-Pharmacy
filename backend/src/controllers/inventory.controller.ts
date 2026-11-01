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

// ============================================================
// CASE-INSENSITIVE MEDICINE + BATCH DUPLICATE CHECK
// ============================================================

const normalizeInventoryDuplicateKey = (
  value: unknown
): string => {
  return String(value ?? "")
    .trim()
    .toLowerCase();
};


const isValidInventoryExpiryDate = (value: unknown): boolean => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === text
  );
};

const isInventoryUniqueConstraintError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );


const parseInventoryBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return false;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "vat", "13%"].includes(normalized)) return true;
  if (["false", "0", "no", "vat free", "0%"].includes(normalized)) return false;
  return null;
};


const findDuplicateMedicineBatchSafe = async (
  medicineBrand: string,
  batchNumber: string,
  excludeId?: number
) => {

  const targetBrand =
    normalizeInventoryDuplicateKey(
      medicineBrand
    );

  const targetBatch =
    normalizeInventoryDuplicateKey(
      batchNumber
    );

  const inventory =
    await prisma.inventory.findMany({
      select: {
        id: true,
        medicineBrand: true,
        batchNumber: true,
      },
    });

  return (
    inventory.find((item) => {

      if (
        excludeId !== undefined &&
        item.id === excludeId
      ) {
        return false;
      }

      const sameBrand =
        normalizeInventoryDuplicateKey(
          item.medicineBrand
        ) === targetBrand;

      const sameBatch =
        normalizeInventoryDuplicateKey(
          item.batchNumber
        ) === targetBatch;

      return sameBrand && sameBatch;

    }) ?? null
  );
};



type DistributorResolution = {
  provided: boolean;
  id: number | null;
  name: string;
  error?: string;
};


const resolveInventoryDistributor = async (
  body: any
): Promise<DistributorResolution> => {

  const rawId =
    body.distributorId ??
    body.supplierId;

  const supplierName =
    String(
      body.supplierName ??
      body.distributorName ??
      ""
    ).trim();


  // Explicit blank/null means clear relation.
  if (
    rawId === null ||
    rawId === ""
  ) {
    return {
      provided: true,
      id: null,
      name: "",
    };
  }


  // Resolve by ID.
  if (rawId !== undefined) {

    const match =
      String(rawId)
        .trim()
        .match(/(\d+)$/);

    const numericPart =
      match?.[1];

    if (!numericPart) {
      return {
        provided: true,
        id: null,
        name: "",
        error:
          "Invalid distributor/supplier ID.",
      };
    }

    const id =
      Number.parseInt(
        numericPart,
        10
      );

    const distributor =
      await prisma.distributor.findUnique({
        where: {
          id,
        },
      });

    if (!distributor) {
      return {
        provided: true,
        id: null,
        name: "",
        error:
          `Distributor with ID ${id} not found.`,
      };
    }

    return {
      provided: true,
      id:
        distributor.id,
      name:
        distributor.name,
    };
  }


  // Resolve by supplier/distributor name.
  if (supplierName) {

    const distributor =
      await prisma.distributor.findFirst({
        where: {
          name: {
            equals:
              supplierName,

            mode:
              "insensitive",
          },
        },
      });

    if (!distributor) {
      return {
        provided: true,
        id: null,
        name:
          supplierName,
        error:
          `Distributor '${supplierName}' not found.`,
      };
    }

    return {
      provided: true,
      id:
        distributor.id,
      name:
        distributor.name,
    };
  }


  return {
    provided: false,
    id: null,
    name: "",
  };
};


export const formatInventoryItem = (inv: any) => {
  const medicineCode = formatMedicineCode(inv.id);
  return {

    distributorId:
      inv.distributorId ?? null,

    supplierId:
      inv.distributorId
        ? String(inv.distributorId)
        : "",

    distributorName:
      inv.distributor?.name ?? "",

    supplierName:
      inv.distributor?.name ?? "",

    barcode:
      inv.barcode ?? "",

    notes:
      inv.notes ?? "",

    saleStatus: inv.saleStatus ?? "SELLABLE",
    safetyStatus: inv.saleStatus ?? "SELLABLE",
    isRecalled: (inv.saleStatus ?? "SELLABLE") === "RECALLED",
    isQuarantined: (inv.saleStatus ?? "SELLABLE") === "QUARANTINED",
    safetyReason: inv.safetyReason ?? "",
    safetyChangedAt: inv.safetyChangedAt ?? null,
    safetyChangedBy: inv.safetyChangedBy ?? "",

    id: medicineCode, // Formatted ID e.g. "MED-001"
    medicineCode,
    medicineBrand: inv.medicineBrand,
    name: inv.medicineBrand, // friendly alias
    generic: {
      id: formatGenericCode(inv.generic?.id ?? 0), // "GEN-001"
      genericCode: formatGenericCode(inv.generic?.id ?? 0),
      name:
        !inv.generic?.name ||
        inv.generic.name === "Unassigned"
          ? ""
          : inv.generic.name,
    },
    genericName:
      !inv.generic?.name ||
      inv.generic.name === "Unassigned"
        ? ""
        : inv.generic.name,
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

        distributor: true,},
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

        distributor: true,},
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

    if (!isValidInventoryExpiryDate(expiry)) {
      res.status(400).json({
        success: false,
        message: "Expiry date must be a valid calendar date in YYYY-MM-DD format.",
      });
      return;
    }


    // ========================================================
    // DUPLICATE MEDICINE + BATCH PROTECTION
    //
    // Brand + batch identifies one physical medicine batch.
    // Comparison is case-insensitive and trimmed.
    // ========================================================

    const duplicateMedicineOnCreate =
      await findDuplicateMedicineBatchSafe(
        brand,
        batch
      );

    if (duplicateMedicineOnCreate) {
      res.status(409).json({
        success: false,
        message:
          `Medicine '${brand}' with batch '${batch}' already exists as ${formatMedicineCode(duplicateMedicineOnCreate.id)}. Update the existing record or use bulk import merge.`,
      });
      return;
    }



    const distributorResolutionOnCreate =
      await resolveInventoryDistributor(
        req.body
      );

    if (
      distributorResolutionOnCreate.error
    ) {
      res.status(400).json({
        success: false,
        message:
          distributorResolutionOnCreate.error,
      });
      return;
    }

    const finalDistributorId =
      distributorResolutionOnCreate.provided
        ? distributorResolutionOnCreate.id
        : null;

    const normalizedBarcode =
      req.body.barcode === undefined ||
      req.body.barcode === null
        ? null
        : String(
            req.body.barcode
          ).trim() || null;

    const normalizedNotes =
      req.body.notes === undefined ||
      req.body.notes === null
        ? null
        : String(
            req.body.notes
          ).trim() || null;


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

    // 4. Numerical and pricing validation. Never silently clamp or truncate
    // invalid physical stock / monetary values.
    const finalUnitPerPack = Number(unitPerPack ?? unitsPerPack ?? 10);
    const finalPackInStock = Number(packInStock ?? stockPacks ?? 0);
    const finalUnitInStock = Number(unitInStock ?? stockLooseUnits ?? 0);
    const finalAlertLevel = Number(packAlertLevel ?? reorderLevel ?? 15);
    const finalCostPrice = Number(costPrice ?? 0);
    const finalSellingPrice = Number(sellingPrice ?? mrpPrice ?? 0);
    const finalHasVat = parseInventoryBoolean(
      hasvat ?? isVatApplicable ?? false
    );

    if (!Number.isInteger(finalUnitPerPack) || finalUnitPerPack <= 0) {
      res.status(400).json({ success: false, message: "Units per pack must be a positive whole number." });
      return;
    }
    if (!Number.isInteger(finalPackInStock) || finalPackInStock < 0) {
      res.status(400).json({ success: false, message: "Pack stock must be a non-negative whole number." });
      return;
    }
    if (!Number.isInteger(finalUnitInStock) || finalUnitInStock < 0) {
      res.status(400).json({ success: false, message: "Loose-unit stock must be a non-negative whole number." });
      return;
    }
    if (finalUnitInStock >= finalUnitPerPack) {
      res.status(400).json({
        success: false,
        message: `Loose-unit stock must be less than units per pack (${finalUnitPerPack}). Convert full units into packs.`,
      });
      return;
    }
    if (!Number.isInteger(finalAlertLevel) || finalAlertLevel < 0) {
      res.status(400).json({ success: false, message: "Reorder level must be a non-negative whole number." });
      return;
    }
    if (!Number.isFinite(finalCostPrice) || finalCostPrice < 0) {
      res.status(400).json({ success: false, message: "Cost price must be zero or a positive number." });
      return;
    }
    if (!Number.isFinite(finalSellingPrice) || finalSellingPrice < 0) {
      res.status(400).json({ success: false, message: "Selling price must be zero or a positive number." });
      return;
    }
    if (finalHasVat === null) {
      res.status(400).json({ success: false, message: "VAT applicability must be true or false." });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const batchLockKey =
        `inventory-batch:${brand.toLowerCase()}|${batch.toLowerCase()}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${batchLockKey}))
      `;

      const duplicate = await tx.inventory.findFirst({
        where: {
          medicineBrand: { equals: brand, mode: "insensitive" },
          batchNumber: { equals: batch, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error("DUPLICATE_INVENTORY_BATCH");
      }

      return tx.inventory.create({
        data: {
          medicineBrand: brand,
          batchNumber: batch,
          expiryDate: expiry,
          genericId: finalGenericId,
          categoryId: finalCategoryId,
          rackId: finalRackId,
          distributorId: finalDistributorId,
          barcode: normalizedBarcode,
          notes: normalizedNotes,
          unitPerPack: finalUnitPerPack,
          packInStock: finalPackInStock,
          unitInStock: finalUnitInStock,
          packAlertLevel: finalAlertLevel,
          costPrice: finalCostPrice,
          sellingPrice: finalSellingPrice,
          hasvat: finalHasVat,
        },
        include: {
          generic: true,
          category: true,
          rack: true,
          distributor: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: `Medicine '${created.medicineBrand}' added to inventory successfully`,
      data: formatInventoryItem(created),
    });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    if (
      (error instanceof Error && error.message === "DUPLICATE_INVENTORY_BATCH") ||
      isInventoryUniqueConstraintError(error)
    ) {
      res.status(409).json({
        success: false,
        message: "That medicine brand and batch already exists in inventory.",
      });
      return;
    }
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
      saleStatus,
      safetyStatus,
      inventoryStatus,
      status,
      recalled,
      quarantined,
      isRecalled,
      isQuarantined,
      safetyReason,
      statusReason,
      recallReason,
      quarantineReason,
      reason,
    } = req.body;

    const updateData: any = {};

    // Persistent batch safety state.
    // Accept canonical application fields plus compatibility aliases used by
    // external clients and production QA.
    const requestedStatusRaw =
      saleStatus ??
      safetyStatus ??
      inventoryStatus ??
      status;

    const recalledFlag =
      isRecalled ??
      recalled;

    const quarantinedFlag =
      isQuarantined ??
      quarantined;

    let requestedSafetyStatus: string | undefined;

    // An explicit status takes precedence. This also makes requests such as
    // { status: "recalled", recalled: true, quarantined: true } deterministic.
    if (requestedStatusRaw !== undefined) {
      requestedSafetyStatus =
        String(requestedStatusRaw)
          .trim()
          .toUpperCase();
    } else if (recalledFlag === true) {
      requestedSafetyStatus = "RECALLED";
    } else if (quarantinedFlag === true) {
      requestedSafetyStatus = "QUARANTINED";
    } else if (
      recalledFlag === false ||
      quarantinedFlag === false
    ) {
      requestedSafetyStatus = "SELLABLE";
    }

    const allowedSafetyStatuses = new Set(["SELLABLE", "QUARANTINED", "RECALLED"]);
    if (requestedSafetyStatus && !allowedSafetyStatuses.has(requestedSafetyStatus)) {
      res.status(400).json({ success: false, message: "Safety status must be SELLABLE, QUARANTINED, or RECALLED." });
      return;
    }

    const requestedSafetyReason = String(
      safetyReason ?? statusReason ?? recallReason ?? quarantineReason ?? reason ?? ""
    ).trim();

    if (requestedSafetyStatus && requestedSafetyStatus !== existing.saleStatus) {
      updateData.saleStatus = requestedSafetyStatus;
      updateData.safetyReason = requestedSafetyReason ||
        (requestedSafetyStatus === "SELLABLE"
          ? "Batch returned to sellable status"
          : `Batch marked ${requestedSafetyStatus.toLowerCase()}`);
      updateData.safetyChangedAt = new Date();
      updateData.safetyChangedBy = String(
        (req as any).user?.username ?? (req as any).user?.id ?? "authenticated-user"
      );
    }


    if (medicineBrand !== undefined || name !== undefined) {
      const b = (medicineBrand || name)?.trim();
      if (b) updateData.medicineBrand = b;
    }

    if (batchNumber !== undefined) {
      const normalizedBatch = String(batchNumber).trim();
      if (!normalizedBatch) {
        res.status(400).json({ success: false, message: "Batch number cannot be empty." });
        return;
      }
      updateData.batchNumber = normalizedBatch;
    }

    if (expiryDate !== undefined) {
      const normalizedExpiry = String(expiryDate).trim();
      if (!isValidInventoryExpiryDate(normalizedExpiry)) {
        res.status(400).json({
          success: false,
          message: "Expiry date must be a valid calendar date in YYYY-MM-DD format.",
        });
        return;
      }
      updateData.expiryDate = normalizedExpiry;
    }

    // Resolve Generic if provided
    if (genericId !== undefined) {
      const parsedGenericId = Number(genericId);
      if (!Number.isInteger(parsedGenericId) || parsedGenericId <= 0) {
        res.status(400).json({ success: false, message: "Generic ID must be a positive whole number." });
        return;
      }
      const genericExists = await prisma.generic.findUnique({ where: { id: parsedGenericId } });
      if (!genericExists) {
        res.status(400).json({ success: false, message: `Generic with ID ${parsedGenericId} not found.` });
        return;
      }
      updateData.genericId = parsedGenericId;
    } else if (genericName !== undefined) {
      const cleanGen = String(genericName).trim();
      if (!cleanGen || cleanGen.toLowerCase() === "unassigned") {
        const unassignedGen = await prisma.generic.upsert({
          where: { name: "Unassigned" },
          update: {},
          create: { name: "Unassigned" },
        });
        updateData.genericId = unassignedGen.id;
      } else {
        const gRecord = await prisma.generic.upsert({
          where: { name: cleanGen },
          update: {},
          create: { name: cleanGen },
        });
        updateData.genericId = gRecord.id;
      }
    }

    // Resolve Category if provided
    const catInput = categoryName || category;
    if (categoryId !== undefined) {
      const parsedCategoryId = Number(categoryId);
      if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
        res.status(400).json({ success: false, message: "Category ID must be a positive whole number." });
        return;
      }
      const categoryExists = await prisma.category.findUnique({ where: { id: parsedCategoryId } });
      if (!categoryExists) {
        res.status(400).json({ success: false, message: `Category with ID ${parsedCategoryId} not found.` });
        return;
      }
      updateData.categoryId = parsedCategoryId;
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
        const parsed = Number(rackId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          res.status(400).json({ success: false, message: "Rack ID must be a positive whole number." });
          return;
        }
        const rackExists = await prisma.rack.findUnique({ where: { id: parsed } });
        if (!rackExists) {
          res.status(400).json({ success: false, message: `Rack with ID ${parsed} not found.` });
          return;
        }
        updateData.rackId = parsed;
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
      const val = Number(unitPerPack ?? unitsPerPack);
      if (!Number.isInteger(val) || val <= 0) {
        res.status(400).json({ success: false, message: "Units per pack must be a positive whole number." });
        return;
      }
      if (existing.unitInStock >= val) {
        res.status(409).json({
          success: false,
          message: `Units per pack cannot be changed to ${val} while ${existing.unitInStock} loose units are stored. Normalize physical stock first.`,
        });
        return;
      }

      if (val !== existing.unitPerPack) {
        const [historicalSales, historicalPurchases] = await Promise.all([
          prisma.billItem.count({ where: { inventoryId: id } }),
          prisma.purchaseInvoiceItem.count({ where: { inventoryId: id } }),
        ]);

        if (historicalSales > 0 || historicalPurchases > 0) {
          res.status(409).json({
            success: false,
            message:
              "Units per pack cannot be changed after this batch has sales or purchase history because returns/cancellations depend on that physical pack size.",
          });
          return;
        }
      }

      updateData.unitPerPack = val;
    }

    /*
     * STOCK QUANTITY SAFETY
     *
     * Normal inventory editing may update medicine metadata,
     * pricing, rack, VAT, etc., but it must not silently
     * change physical stock.
     *
     * All actual stock changes must go through:
     *
     *   POST /inventory/:id/adjust
     *
     * so a StockAdjustmentLog is always created.
     *
     * We still tolerate forms that send the current unchanged
     * stock values back to the API.
     */
    if (
      packInStock !== undefined ||
      stockPacks !== undefined
    ) {
      const requestedPacks =
        Number(
          packInStock ??
          stockPacks
        );

      if (
        !Number.isInteger(
          requestedPacks
        ) ||
        requestedPacks < 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Pack stock must be a non-negative whole number.",
        });

        return;
      }

      if (
        requestedPacks !==
        existing.packInStock
      ) {
        res.status(409).json({
          success: false,
          message:
            "Physical stock cannot be changed through normal inventory editing. Use the Physical Stock Adjustment workflow so the change is audited.",
        });

        return;
      }
    }

    if (
      unitInStock !== undefined ||
      stockLooseUnits !== undefined
    ) {
      const requestedLoose =
        Number(
          unitInStock ??
          stockLooseUnits
        );

      if (
        !Number.isInteger(
          requestedLoose
        ) ||
        requestedLoose < 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Loose-unit stock must be a non-negative whole number.",
        });

        return;
      }

      if (
        requestedLoose !==
        existing.unitInStock
      ) {
        res.status(409).json({
          success: false,
          message:
            "Physical stock cannot be changed through normal inventory editing. Use the Physical Stock Adjustment workflow so the change is audited.",
        });

        return;
      }
    }

    if (packAlertLevel !== undefined || reorderLevel !== undefined) {
      const val = Number(packAlertLevel ?? reorderLevel);
      if (!Number.isInteger(val) || val < 0) {
        res.status(400).json({
          success: false,
          message: "Reorder level must be a non-negative whole number.",
        });
        return;
      }
      updateData.packAlertLevel = val;
    }

    if (costPrice !== undefined) {
      const val = Number(costPrice);
      if (!Number.isFinite(val) || val < 0) {
        res.status(400).json({ success: false, message: "Cost price must be zero or a positive number." });
        return;
      }
      updateData.costPrice = val;
    }

    if (sellingPrice !== undefined || mrpPrice !== undefined) {
      const val = Number(sellingPrice ?? mrpPrice);
      if (!Number.isFinite(val) || val < 0) {
        res.status(400).json({ success: false, message: "Selling price must be zero or a positive number." });
        return;
      }
      updateData.sellingPrice = val;
    }

    if (hasvat !== undefined || isVatApplicable !== undefined) {
      const parsedVat = parseInventoryBoolean(hasvat ?? isVatApplicable);
      if (parsedVat === null) {
        res.status(400).json({ success: false, message: "VAT applicability must be true or false." });
        return;
      }
      updateData.hasvat = parsedVat;
    }


    const candidateBrandForDuplicateCheck =
      String(
        updateData.medicineBrand ??
        existing.medicineBrand
      ).trim();

    const candidateBatchForDuplicateCheck =
      String(
        updateData.batchNumber ??
        existing.batchNumber
      ).trim();

    const duplicateAfterUpdate =
      await findDuplicateMedicineBatchSafe(
        candidateBrandForDuplicateCheck,
        candidateBatchForDuplicateCheck,
        id
      );

    if (duplicateAfterUpdate) {
      res.status(409).json({
        success: false,
        message:
          `Another inventory record already uses medicine '${candidateBrandForDuplicateCheck}' with batch '${candidateBatchForDuplicateCheck}' (${formatMedicineCode(duplicateAfterUpdate.id)}).`,
      });
      return;
    }



    const distributorResolutionOnUpdate =
      await resolveInventoryDistributor(
        req.body
      );

    if (
      distributorResolutionOnUpdate.error
    ) {
      res.status(400).json({
        success: false,
        message:
          distributorResolutionOnUpdate.error,
      });
      return;
    }

    if (
      distributorResolutionOnUpdate.provided
    ) {
      updateData.distributorId =
        distributorResolutionOnUpdate.id;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "barcode"
      )
    ) {
      updateData.barcode =
        req.body.barcode === null
          ? null
          : String(
              req.body.barcode
            ).trim() || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "notes"
      )
    ) {
      updateData.notes =
        req.body.notes === null
          ? null
          : String(
              req.body.notes
            ).trim() || null;
    }


    const updated = await prisma.$transaction(async (tx) => {
      const batchLockKey =
        `inventory-batch:${candidateBrandForDuplicateCheck.toLowerCase()}|${candidateBatchForDuplicateCheck.toLowerCase()}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${batchLockKey}))
      `;

      const duplicate = await tx.inventory.findFirst({
        where: {
          id: { not: id },
          medicineBrand: { equals: candidateBrandForDuplicateCheck, mode: "insensitive" },
          batchNumber: { equals: candidateBatchForDuplicateCheck, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error("DUPLICATE_INVENTORY_BATCH");
      }

      const updatedInventory = await tx.inventory.update({
        where: { id },
        data: updateData,
        include: {
          generic: true,
          category: true,
          rack: true,
          distributor: true,
        },
      });

      if (requestedSafetyStatus && requestedSafetyStatus !== existing.saleStatus) {
        await tx.inventorySafetyStatusLog.create({
          data: {
            medicineId: id,
            previousStatus: existing.saleStatus ?? "SELLABLE",
            newStatus: requestedSafetyStatus,
            reason: updateData.safetyReason,
            recordedBy: updateData.safetyChangedBy,
          },
        });
      }

      return updatedInventory;
    });

    res.status(200).json({
      success: true,
      message: `Medicine '${updated.medicineBrand}' updated successfully`,
      data: formatInventoryItem(updated),
    });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    if (
      (error instanceof Error && error.message === "DUPLICATE_INVENTORY_BATCH") ||
      isInventoryUniqueConstraintError(error)
    ) {
      res.status(409).json({
        success: false,
        message: "Another inventory row already uses that medicine brand and batch.",
      });
      return;
    }
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
          select: {
            billItems: true,
            purchaseInvoiceItems: true,
            salesReturnItems: true,
            stockAdjustmentLogs: true,
          },
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

    if (existing.packInStock > 0 || existing.unitInStock > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete '${existing.medicineBrand}' while physical stock remains. Adjust stock to zero through the audited Physical Stock Adjustment workflow first.`,
      });
      return;
    }

    const historicalLinks =
      existing._count.billItems +
      existing._count.purchaseInvoiceItems +
      existing._count.salesReturnItems +
      existing._count.stockAdjustmentLogs;

    if (historicalLinks > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete '${existing.medicineBrand}' because it has historical sales, purchase, return, or stock-audit records. Keep the zero-stock record for audit integrity.`,
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
    const sixMonthsAhead = new Date();
    sixMonthsAhead.setMonth(now.getMonth() + 6);

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
          } else if (expDate <= sixMonthsAhead) {
            nearExpiryCount++;
          }
        }
      }

      // Valuations
      const loosePackEquivalent =
        item.unitPerPack > 0
          ? loose / item.unitPerPack
          : 0;

      const effectivePacks =
        packs + loosePackEquivalent;

      totalCostValuation +=
        effectivePacks * cost;

      totalRetailValuation +=
        effectivePacks * selling;
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

