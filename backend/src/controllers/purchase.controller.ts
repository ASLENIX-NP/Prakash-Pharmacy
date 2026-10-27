import { Request, Response } from "express";
import { prisma } from "../db.js";
import {
  formatDistributorCode,
  formatMedicineCode,
  formatPurchaseCode,
  parseIdParam,
} from "../utils/id.helpers.js";

// Helper to format a database purchase invoice row
export const formatPurchaseResponse = (purchase: any) => {
  const dateObj = new Date(purchase.purchaseDate || purchase.createdAt);
  const dateStr = dateObj.toISOString().split("T")[0];

  const formattedItems = (purchase.items || []).map((it: any) => ({
    id: String(it.id),
    purchaseItemId: it.id,
    medicineId: it.inventoryId ? formatMedicineCode(it.inventoryId) : undefined,
    inventoryId: it.inventoryId || undefined,
    medicineName: it.medicineName,
    genericName: it.genericName || "",
    category: it.categoryName || "Tablet",
    batchNumber: it.batchNumber,
    expiryDate: it.expiryDate,
    packQty: it.packQty,
    freePacks: it.freePacks || 0,
    unitsPerPack: it.unitsPerPack || 10,
    costPrice: Number(it.costPrice || 0),
    discountPercent: Number(it.discountPercent || 0),
    isVatApplicable: Boolean(it.isVatApplicable),
    mrpPrice: Number(it.mrpPrice || 0),
    rackLocation: it.rackLocation || "General Shelf",
    lineTotal: Number(it.lineTotal || 0),
  }));

  return {
    id: formatPurchaseCode(purchase.id),
    purchaseId: purchase.id,
    invoiceNumber: purchase.invoiceNumber,
    stockistId: formatDistributorCode(purchase.distributorId),
    distributorId: purchase.distributorId,
    stockistName: purchase.distributor?.name || "Wholesaler",
    stockistPan: purchase.distributor?.pannumber || "",
    date: dateStr,
    purchaseDate: dateObj.toISOString(),
    paymentMode: (purchase.paymentMode || "credit").toLowerCase(),
    dueDate: purchase.dueDate ? new Date(purchase.dueDate).toISOString().split("T")[0] : undefined,
    subtotal: Number(purchase.subtotal || 0),
    discountAmount: Number(purchase.discountAmount || 0),
    taxableAmount: Number(purchase.taxableAmount || 0),
    vatAmount: Number(purchase.vatAmount || 0),
    grandTotal: Number(purchase.grandTotal || 0),
    notes: purchase.notes || "",
    createdAt: (purchase.createdAt || dateObj).toISOString(),
    items: formattedItems,
  };
};

export const getAllPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { distributorId, paymentMode, startDate, endDate, limit } = req.query;

    const where: any = {};

    const distId = parseIdParam(distributorId as string);
    if (distId) {
      where.distributorId = distId;
    }

    if (paymentMode && typeof paymentMode === "string" && paymentMode.trim()) {
      where.paymentMode = paymentMode.trim().toLowerCase();
    }

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) {
        where.purchaseDate.gte = new Date(String(startDate));
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.purchaseDate.lte = end;
      }
    }

    const take = limit === "all" ? undefined : limit ? parseInt(limit as string, 10) : undefined;

    const purchases = await prisma.purchaseInvoice.findMany({
      where,
      include: {
        distributor: true,
        items: true,
      },
      orderBy: { purchaseDate: "desc" },
      take: take && !isNaN(take) ? take : undefined,
    });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases.map(formatPurchaseResponse),
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase invoices.",
    });
  }
};

export const getPurchaseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid purchase invoice ID." });
      return;
    }

    const purchase = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        distributor: true,
        items: true,
      },
    });

    if (!purchase) {
      res.status(404).json({ success: false, message: "Purchase invoice not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatPurchaseResponse(purchase),
    });
  } catch (error) {
    console.error("Error fetching purchase invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase invoice details.",
    });
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      invoiceNumber,
      stockistId,
      distributorId,
      date,
      purchaseDate,
      paymentMode = "credit",
      dueDate,
      subtotal,
      discountAmount = 0,
      taxableAmount = 0,
      vatAmount = 0,
      grandTotal,
      notes,
      items,
    } = req.body;

    const cleanInvoiceNumber = String(invoiceNumber || "").trim();
    if (!cleanInvoiceNumber) {
      res.status(400).json({ success: false, message: "Wholesaler Invoice / Bill Number is required." });
      return;
    }

    const targetDistributorId = parseIdParam(stockistId || distributorId);
    if (!targetDistributorId) {
      res.status(400).json({ success: false, message: "Valid distributor / stockist ID is required." });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: "Purchase invoice must have at least one medicine item." });
      return;
    }

    // Verify distributor exists
    const distributor = await prisma.distributor.findUnique({
      where: { id: targetDistributorId },
    });
    if (!distributor) {
      res.status(404).json({ success: false, message: "Selected distributor does not exist." });
      return;
    }

    const finalPaymentMode = String(paymentMode).toLowerCase() === "cash" ? "cash" : "credit";
    const parsedPurchaseDate = date ? new Date(date) : purchaseDate ? new Date(purchaseDate) : new Date();
    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    const calcSubtotal = parseFloat(String(subtotal ?? 0)) || 0;
    const calcDiscount = parseFloat(String(discountAmount ?? 0)) || 0;
    const calcTaxable = parseFloat(String(taxableAmount ?? 0)) || 0;
    const calcVat = parseFloat(String(vatAmount ?? 0)) || 0;
    const calcGrandTotal = parseFloat(String(grandTotal ?? (calcSubtotal - calcDiscount + calcVat))) || 0;

    // Execute atomic purchase transaction
    const createdPurchase = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Invoice record
      const invoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber: cleanInvoiceNumber,
          distributorId: targetDistributorId,
          purchaseDate: parsedPurchaseDate,
          paymentMode: finalPaymentMode,
          dueDate: parsedDueDate,
          subtotal: calcSubtotal,
          discountAmount: calcDiscount,
          taxableAmount: calcTaxable,
          vatAmount: calcVat,
          grandTotal: calcGrandTotal,
          notes: notes ? String(notes).trim() : null,
        },
      });

      // 2. Process each item: update or create inventory stock
      for (const item of items) {
        const medicineName = String(item.medicineName || item.name || "").trim();
        if (!medicineName) {
          throw new Error("Medicine brand name is required for all line items.");
        }

        const batchNumber = String(item.batchNumber || `BAT-${Date.now().toString().slice(-5)}`).trim();
        const expiryDate = String(item.expiryDate || "2028-12-31").trim();
        const packQty = Math.max(0, parseInt(String(item.packQty ?? 0), 10) || 0);
        const freePacks = Math.max(0, parseInt(String(item.freePacks ?? 0), 10) || 0);
        const totalPacksReceived = packQty + freePacks;
        const unitsPerPack = Math.max(1, parseInt(String(item.unitsPerPack ?? 10), 10) || 10);
        const costPrice = parseFloat(String(item.costPrice ?? 0)) || 0;
        const mrpPrice = parseFloat(String(item.mrpPrice ?? (costPrice * 1.3))) || (costPrice * 1.3);
        const discountPercent = parseFloat(String(item.discountPercent ?? 0)) || 0;
        const isVatApplicable = Boolean(item.isVatApplicable);
        const lineTotal = parseFloat(String(item.lineTotal ?? (packQty * costPrice * (1 - discountPercent / 100)))) || 0;

        // Resolve Generic
        const genericName = String(item.genericName || medicineName).trim();
        let generic = await tx.generic.findFirst({
          where: { name: { equals: genericName, mode: "insensitive" } },
        });
        if (!generic) {
          generic = await tx.generic.create({
            data: { name: genericName },
          });
        }

        // Resolve Category
        const categoryName = String(item.category || item.categoryName || "Tablet").trim();
        let category = await tx.category.findFirst({
          where: { name: { equals: categoryName, mode: "insensitive" } },
        });
        if (!category) {
          category = await tx.category.create({
            data: { name: categoryName },
          });
        }

        // Resolve Rack
        const rackLocation = String(item.rackLocation || "General Shelf").trim();
        let rack = await tx.rack.findFirst({
          where: { name: { equals: rackLocation, mode: "insensitive" } },
        });
        if (!rack) {
          rack = await tx.rack.create({
            data: {
              name: rackLocation,
              description: "Storage rack location",
            },
          });
        }

        // Check if an inventory batch with same brand and batch number already exists
        const existingInventory = await tx.inventory.findFirst({
          where: {
            medicineBrand: { equals: medicineName, mode: "insensitive" },
            batchNumber: { equals: batchNumber, mode: "insensitive" },
          },
        });

        let linkedInventoryId: number;

        if (existingInventory) {
          // Increment existing batch stock
          const updated = await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              packInStock: existingInventory.packInStock + totalPacksReceived,
              costPrice: costPrice > 0 ? costPrice : existingInventory.costPrice,
              sellingPrice: mrpPrice > 0 ? mrpPrice : existingInventory.sellingPrice,
              expiryDate: expiryDate || existingInventory.expiryDate,
              distributorId: targetDistributorId,
              hasvat: isVatApplicable,
              unitPerPack: unitsPerPack,
              rackId: rack.id,
            },
          });
          linkedInventoryId = updated.id;
        } else {
          // Create new batch inventory record
          const created = await tx.inventory.create({
            data: {
              medicineBrand: medicineName,
              batchNumber,
              expiryDate,
              genericId: generic.id,
              categoryId: category.id,
              rackId: rack.id,
              distributorId: targetDistributorId,
              unitPerPack: unitsPerPack,
              packInStock: totalPacksReceived,
              unitInStock: 0,
              packAlertLevel: 15,
              costPrice,
              sellingPrice: mrpPrice,
              hasvat: isVatApplicable,
              notes: `Purchased via Inward Invoice #${cleanInvoiceNumber}`,
            },
          });
          linkedInventoryId = created.id;
        }

        // Create Purchase Invoice Item
        await tx.purchaseInvoiceItem.create({
          data: {
            invoiceId: invoice.id,
            inventoryId: linkedInventoryId,
            medicineName,
            genericName,
            categoryName,
            batchNumber,
            expiryDate,
            packQty,
            freePacks,
            unitsPerPack,
            costPrice,
            discountPercent,
            isVatApplicable,
            mrpPrice,
            rackLocation: rack.name,
            lineTotal,
          },
        });
      }

      // 3. Post to Distributor Ledger & Update Balance
      const currentBalance = Number(distributor.currentBalance || 0);
      const isCredit = finalPaymentMode === "credit";
      const newBalance = currentBalance + (isCredit ? calcGrandTotal : 0);

      if (isCredit) {
        await tx.distributor.update({
          where: { id: targetDistributorId },
          data: { currentBalance: newBalance },
        });

        await tx.ledger.create({
          data: {
            distributorId: targetDistributorId,
            invoiceId: invoice.id,
            ledgerType: "purchase",
            referenceNo: cleanInvoiceNumber,
            description: `Purchase Bill #${cleanInvoiceNumber} (${items.length} items, Mode: CREDIT)`,
            debitAmount: 0,
            creditAmount: calcGrandTotal,
            balance: newBalance,
          },
        });
      } else {
        // Cash payment invoice - record both credit & debit or settled
        await tx.ledger.create({
          data: {
            distributorId: targetDistributorId,
            invoiceId: invoice.id,
            ledgerType: "purchase",
            referenceNo: cleanInvoiceNumber,
            description: `Purchase Bill #${cleanInvoiceNumber} (Mode: CASH - Fully Settled)`,
            debitAmount: calcGrandTotal,
            creditAmount: calcGrandTotal,
            balance: currentBalance,
          },
        });
      }

      // Return created invoice with full relations
      return tx.purchaseInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          distributor: true,
          items: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      message: `Purchase bill #${cleanInvoiceNumber} created successfully. Stock added to inventory.`,
      data: formatPurchaseResponse(createdPurchase),
    });
  } catch (error) {
    console.error("Error creating purchase invoice:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to record purchase invoice.",
    });
  }
};
