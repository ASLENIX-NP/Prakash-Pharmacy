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
    looseUnits: it.looseUnits || 0,
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
    createdBy: purchase.createdBy || null,
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

class PurchaseValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PurchaseValidationError";
    this.statusCode = statusCode;
  }
}

const roundPurchaseMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;


const isValidPurchaseDateOnly = (value: unknown): boolean => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
};

const parsePurchaseBoolean = (value: unknown, fieldName: string): boolean => {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false" || value === undefined || value === null || value === "") return false;
  throw new PurchaseValidationError(`${fieldName} must be a boolean.`);
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
      notes,
      items,
    } = req.body;

    const authUser = (req as any).user ?? {};
    const recordedBy = String(authUser.username ?? authUser.id ?? "unknown");

    const cleanInvoiceNumber = String(invoiceNumber || "").trim();
    if (!cleanInvoiceNumber) {
      throw new PurchaseValidationError(
        "Wholesaler Invoice / Bill Number is required."
      );
    }

    const targetDistributorId = parseIdParam(stockistId || distributorId);
    if (!targetDistributorId) {
      throw new PurchaseValidationError(
        "Valid distributor / stockist ID is required."
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new PurchaseValidationError(
        "Purchase invoice must have at least one medicine item."
      );
    }

    const finalPaymentMode = String(paymentMode || "credit")
      .trim()
      .toLowerCase();
    if (finalPaymentMode !== "cash" && finalPaymentMode !== "credit") {
      throw new PurchaseValidationError(
        "Payment mode must be either cash or credit."
      );
    }

    const parsedPurchaseDate = date
      ? new Date(date)
      : purchaseDate
        ? new Date(purchaseDate)
        : new Date();
    if (Number.isNaN(parsedPurchaseDate.getTime())) {
      throw new PurchaseValidationError("Purchase date is invalid.");
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      throw new PurchaseValidationError("Due date is invalid.");
    }

    const normalizedItems = items.map((item: any, index: number) => {
      const row = index + 1;
      const medicineName = String(item.medicineName || item.name || "").trim();
      const batchNumber = String(item.batchNumber || "").trim();
      const expiryDate = String(item.expiryDate || "").trim();

      if (!medicineName) {
        throw new PurchaseValidationError(
          `Medicine brand name is required on purchase row ${row}.`
        );
      }
      if (!batchNumber) {
        throw new PurchaseValidationError(
          `Batch number is required for '${medicineName}'.`
        );
      }
      if (!expiryDate || !isValidPurchaseDateOnly(expiryDate)) {
        throw new PurchaseValidationError(
          `Expiry date for '${medicineName}' must be a valid calendar date in YYYY-MM-DD format.`
        );
      }

      const packQty = Number(item.packQty ?? 0);
      const looseUnits = Number(
        item.looseUnits ?? item.stockLooseUnits ?? item.unitInStock ?? 0
      );
      const freePacks = Number(item.freePacks ?? 0);
      const unitsPerPack = Number(item.unitsPerPack ?? 10);
      const costPrice = Number(item.costPrice ?? 0);
      const mrpPrice = Number(item.mrpPrice ?? costPrice * 1.3);
      const discountPercent = Number(item.discountPercent ?? 0);
      const isVatApplicable = parsePurchaseBoolean(
        item.isVatApplicable,
        "isVatApplicable"
      );

      if (
        !Number.isInteger(packQty) || packQty < 0 ||
        !Number.isInteger(looseUnits) || looseUnits < 0 ||
        !Number.isInteger(freePacks) || freePacks < 0
      ) {
        throw new PurchaseValidationError(
          `Purchase quantities for '${medicineName}' must be whole, non-negative numbers.`
        );
      }
      if (!Number.isInteger(unitsPerPack) || unitsPerPack <= 0) {
        throw new PurchaseValidationError(
          `Units per pack for '${medicineName}' must be a positive whole number.`
        );
      }
      if (looseUnits >= unitsPerPack) {
        throw new PurchaseValidationError(
          `Loose units for '${medicineName}' must be less than units per pack; convert complete loose packs into pack quantity.`
        );
      }
      if (packQty + freePacks === 0 && looseUnits === 0) {
        throw new PurchaseValidationError(
          `Purchase row for '${medicineName}' must receive at least one pack or loose unit.`
        );
      }
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw new PurchaseValidationError(
          `Cost price for '${medicineName}' must be zero or positive.`
        );
      }
      if (!Number.isFinite(mrpPrice) || mrpPrice < 0) {
        throw new PurchaseValidationError(
          `MRP / selling price for '${medicineName}' must be zero or positive.`
        );
      }
      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        throw new PurchaseValidationError(
          `Discount percent for '${medicineName}' must be between 0 and 100.`
        );
      }

      const looseCost = costPrice / unitsPerPack;
      const grossLine = roundPurchaseMoney(
        packQty * costPrice + looseUnits * looseCost
      );
      const lineDiscount = roundPurchaseMoney(
        grossLine * discountPercent / 100
      );
      const lineTotal = roundPurchaseMoney(grossLine - lineDiscount);
      const lineVat = isVatApplicable
        ? roundPurchaseMoney(lineTotal * 0.13)
        : 0;

      return {
        medicineName,
        batchNumber,
        expiryDate,
        packQty,
        looseUnits,
        freePacks,
        unitsPerPack,
        costPrice: roundPurchaseMoney(costPrice),
        mrpPrice: roundPurchaseMoney(mrpPrice),
        discountPercent,
        isVatApplicable,
        grossLine,
        lineDiscount,
        lineTotal,
        lineVat,
        genericName: String(item.genericName || medicineName).trim(),
        categoryName: String(item.category || item.categoryName || "Tablet").trim(),
        rackLocation: String(item.rackLocation || "General Shelf").trim(),
      };
    });

    const calcSubtotal = roundPurchaseMoney(
      normalizedItems.reduce((sum, item) => sum + item.grossLine, 0)
    );
    const calcDiscount = roundPurchaseMoney(
      normalizedItems.reduce((sum, item) => sum + item.lineDiscount, 0)
    );
    const calcTaxable = roundPurchaseMoney(
      normalizedItems.reduce(
        (sum, item) => sum + (item.isVatApplicable ? item.lineTotal : 0),
        0
      )
    );
    const calcVat = roundPurchaseMoney(
      normalizedItems.reduce((sum, item) => sum + item.lineVat, 0)
    );
    const calcGrandTotal = roundPurchaseMoney(
      normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0) + calcVat
    );

    const createdPurchase = await prisma.$transaction(async (tx) => {
      // Serialize duplicate checks for this supplier invoice number without
      // relying on a new database uniqueness rule that could break legacy DBs.
      const invoiceLockKey =
        `purchase:${targetDistributorId}:${cleanInvoiceNumber.toLowerCase()}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${invoiceLockKey}))
      `;

      const supplierAccountLockKey = `supplier-account:${targetDistributorId}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${supplierAccountLockKey}))
      `;

      const distributor = await tx.distributor.findUnique({
        where: { id: targetDistributorId },
      });
      if (!distributor) {
        throw new PurchaseValidationError(
          "Selected distributor does not exist.",
          404
        );
      }

      if (String(distributor.status || "active").trim().toLowerCase() !== "active") {
        throw new PurchaseValidationError(
          "Selected distributor is inactive and cannot receive new purchase invoices.",
          409
        );
      }

      const duplicate = await tx.purchaseInvoice.findFirst({
        where: {
          distributorId: targetDistributorId,
          invoiceNumber: {
            equals: cleanInvoiceNumber,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new PurchaseValidationError(
          `Purchase invoice '${cleanInvoiceNumber}' already exists for this distributor.`,
          409
        );
      }

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
          createdBy: recordedBy,
        },
      });

      for (const item of normalizedItems) {
        const {
          medicineName,
          batchNumber,
          expiryDate,
          packQty,
          looseUnits,
          freePacks,
          unitsPerPack,
          costPrice,
          mrpPrice,
          discountPercent,
          isVatApplicable,
          lineTotal,
          genericName,
          categoryName,
          rackLocation,
        } = item;
        const totalPacksReceived = packQty + freePacks;

        let generic = await tx.generic.findFirst({
          where: { name: { equals: genericName, mode: "insensitive" } },
        });
        if (!generic) {
          generic = await tx.generic.create({ data: { name: genericName } });
        }

        let category = await tx.category.findFirst({
          where: { name: { equals: categoryName, mode: "insensitive" } },
        });
        if (!category) {
          category = await tx.category.create({ data: { name: categoryName } });
        }

        let rack = await tx.rack.findFirst({
          where: { name: { equals: rackLocation, mode: "insensitive" } },
        });
        if (!rack) {
          rack = await tx.rack.create({
            data: { name: rackLocation, description: "Storage rack location" },
          });
        }

        // Brand + batch identifies one physical manufacturer batch in this
        // schema. Lock that identity without including expiry/distributor so
        // case variants or conflicting metadata cannot race into two rows.
        const batchLockKey =
          `inventory-batch:${medicineName.trim().toLowerCase()}|${batchNumber.trim().toLowerCase()}`;
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${batchLockKey}))
        `;

        const existingInventory = await tx.inventory.findFirst({
          where: {
            medicineBrand: { equals: medicineName, mode: "insensitive" },
            batchNumber: { equals: batchNumber, mode: "insensitive" },
          },
        });

        let linkedInventoryId: number;

        if (existingInventory) {
          const existingUnitsPerPack = Math.max(
            1,
            Number(existingInventory.unitPerPack || 1)
          );

          if (String(existingInventory.expiryDate).trim() !== expiryDate) {
            throw new PurchaseValidationError(
              `Medicine '${medicineName}' batch '${batchNumber}' already exists with expiry '${existingInventory.expiryDate}', not '${expiryDate}'. Reconcile the batch metadata before receiving stock.`,
              409
            );
          }

          if (
            existingInventory.distributorId !== null &&
            existingInventory.distributorId !== targetDistributorId
          ) {
            throw new PurchaseValidationError(
              `Medicine '${medicineName}' batch '${batchNumber}' is already attributed to another distributor. Do not commingle supplier provenance in one inventory row.`,
              409
            );
          }

          if (unitsPerPack !== existingUnitsPerPack) {
            throw new PurchaseValidationError(
              `Cannot add purchase item '${medicineName}' batch '${batchNumber}' to the existing inventory batch because units per pack differ. Existing batch: ${existingUnitsPerPack}; purchase: ${unitsPerPack}.`,
              409
            );
          }

          const incomingUnits =
            totalPacksReceived * existingUnitsPerPack + looseUnits;

          const rows = await tx.$queryRaw<Array<{ id: number }>>`
            UPDATE inventory_tbl
               SET pack_in_stock =
                     ((pack_in_stock * unit_per_pack + unit_in_stock + ${incomingUnits}) / unit_per_pack),
                   unit_in_stock =
                     MOD(pack_in_stock * unit_per_pack + unit_in_stock + ${incomingUnits}, unit_per_pack),
                   distributor_id = COALESCE(distributor_id, ${targetDistributorId})
             WHERE id = ${existingInventory.id}
            RETURNING id
          `;

          if (!rows[0]) {
            throw new PurchaseValidationError(
              `Inventory batch '${batchNumber}' changed while receiving the purchase. Retry the operation.`,
              409
            );
          }

          linkedInventoryId = Number(rows[0].id);
        } else {
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
              unitInStock: looseUnits,
              packAlertLevel: 15,
              costPrice,
              sellingPrice: mrpPrice,
              hasvat: isVatApplicable,
              notes: `Purchased via Inward Invoice #${cleanInvoiceNumber}`,
            },
          });
          linkedInventoryId = created.id;
        }

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
            looseUnits,
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

      let ledgerBalance = Number(distributor.currentBalance || 0);

      if (finalPaymentMode === "credit") {
        const updatedDistributor = await tx.distributor.update({
          where: { id: targetDistributorId },
          data: {
            currentBalance: { increment: calcGrandTotal },
          },
        });
        ledgerBalance = Number(updatedDistributor.currentBalance || 0);

        await tx.ledger.create({
          data: {
            distributorId: targetDistributorId,
            invoiceId: invoice.id,
            ledgerType: "purchase",
            referenceNo: cleanInvoiceNumber,
            description: `Purchase Bill #${cleanInvoiceNumber} (${normalizedItems.length} items, Mode: CREDIT)`,
            recordedBy,
            debitAmount: 0,
            creditAmount: calcGrandTotal,
            balance: ledgerBalance,
          },
        });
      } else {
        const freshDistributor = await tx.distributor.findUnique({
          where: { id: targetDistributorId },
          select: { currentBalance: true },
        });
        ledgerBalance = Number(freshDistributor?.currentBalance || 0);

        await tx.ledger.create({
          data: {
            distributorId: targetDistributorId,
            invoiceId: invoice.id,
            ledgerType: "purchase",
            referenceNo: cleanInvoiceNumber,
            description: `Purchase Bill #${cleanInvoiceNumber} (Mode: CASH - Fully Settled)`,
            recordedBy,
            debitAmount: calcGrandTotal,
            creditAmount: calcGrandTotal,
            balance: ledgerBalance,
          },
        });
      }

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

    const statusCode =
      error instanceof PurchaseValidationError
        ? error.statusCode
        : 500;

    res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to record purchase invoice.",
    });
  }
};

class PurchaseCancellationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "PurchaseCancellationConflictError";
  }
}


// ==========================================
// 4. CANCEL / DELETE PURCHASE INVOICE
// ==========================================
export const deletePurchase = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id =
      parseIdParam(
        req.params.id
      );

    if (!id) {
      res.status(400).json({
        success: false,
        message:
          "Invalid purchase invoice ID.",
      });

      return;
    }

    const authUser = (req as any).user ?? {};
    const cancelledBy = String(authUser.username ?? authUser.id ?? "unknown");
    const cancellationReason = String(req.body?.reason || "Purchase invoice cancelled").trim();


    const purchase =
      await prisma.purchaseInvoice.findUnique({
        where: {
          id,
        },

        include: {
          distributor: true,
          items: true,
        },
      });


    if (!purchase) {
      res.status(404).json({
        success: false,
        message:
          "Purchase invoice not found.",
      });

      return;
    }


    await prisma.$transaction(
      async (tx) => {
        // Serialize cancellation/replay of the same purchase invoice. A second
        // concurrent cancellation observes that the row is gone and aborts
        // before touching stock or supplier accounting.
        const lockedPurchaseRows = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id
            FROM purchase_invoice_tbl
           WHERE id = ${id}
           FOR UPDATE
        `;

        if (!lockedPurchaseRows[0]) {
          throw new PurchaseCancellationConflictError(
            "Purchase invoice is already cancelled or no longer exists."
          );
        }

        const purchase = await tx.purchaseInvoice.findUnique({
          where: { id },
          include: { distributor: true, items: true },
        });

        if (!purchase) {
          throw new PurchaseCancellationConflictError(
            "Purchase invoice is already cancelled or no longer exists."
          );
        }

        const supplierAccountLockKey = `supplier-account:${purchase.distributorId}`;
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${supplierAccountLockKey}))
        `;

        /*
         * CREDIT PURCHASE ACCOUNTING GUARD
         *
         * Payments/returns are not allocated to individual
         * purchase invoices in the current schema.
         *
         * Therefore an older credit purchase must not be
         * deleted after later supplier ledger activity,
         * otherwise currentBalance and later ledger balance
         * snapshots become unreliable.
         */
        if (
          purchase.paymentMode
            .toLowerCase() ===
          "credit"
        ) {
          const purchaseLedger =
            await tx.ledger.findFirst({
              where: {
                distributorId:
                  purchase.distributorId,

                OR: [
                  {
                    invoiceId:
                      purchase.id,
                  },

                  {
                    referenceNo:
                      purchase.invoiceNumber,

                    ledgerType:
                      "purchase",
                  },
                ],
              },

              orderBy: {
                id: "asc",
              },
            });


          if (!purchaseLedger) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: its supplier ledger entry is missing. Manual accounting review is required.`
            );
          }


          const laterLedger =
            await tx.ledger.findFirst({
              where: {
                distributorId:
                  purchase.distributorId,

                id: {
                  gt:
                    purchaseLedger.id,
                },
              },

              orderBy: {
                id: "asc",
              },
            });


          if (laterLedger) {
            const activity =
              laterLedger.ledgerType ===
              "payment"
                ? "supplier payment"
                : laterLedger.ledgerType ===
                  "return"
                  ? "supplier return / debit note"
                  : laterLedger.ledgerType ===
                    "purchase"
                    ? "later purchase"
                    : "later supplier ledger activity";

            throw new PurchaseCancellationConflictError(
              `Cannot cancel credit purchase #${purchase.invoiceNumber} because a ${activity} was recorded afterward. Reverse/reconcile the later supplier activity first.`
            );
          }
        }


        /*
         * STOCK SAFETY GUARDS
         *
         * Never clamp stock to zero.
         *
         * If the linked stock was sold, returned, adjusted,
         * or there is no longer enough quantity available,
         * cancellation is rejected instead of corrupting
         * inventory.
         */
        for (
          const item of
            purchase.items
        ) {
          if (!item.inventoryId) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: linked inventory is missing for '${item.medicineName}'.`
            );
          }


          await tx.$queryRaw`
            SELECT id
              FROM inventory_tbl
             WHERE id = ${item.inventoryId}
             FOR UPDATE
          `;

          const inventory =
            await tx.inventory.findUnique({
              where: {
                id:
                  item.inventoryId,
              },
            });


          if (!inventory) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: inventory batch for '${item.medicineName}' no longer exists.`
            );
          }


          const purchasedPacks =
            item.packQty +
            (item.freePacks || 0);

          const purchasedLoose =
            item.looseUnits || 0;


          /*
           * A sale after this purchase means we cannot prove
           * that the exact purchased quantity remains untouched.
           */
          const laterSales =
            await tx.billItem.count({
              where: {
                inventoryId:
                  inventory.id,

                invoice: {
                  transactionDate: {
                    gte:
                      purchase.createdAt,
                  },
                },
              },
            });


          if (laterSales > 0) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: '${item.medicineName}' has sales recorded after this purchase. Reverse/return those sales before cancelling the purchase.`
            );
          }


          /*
           * Wholesaler returns and physical stock changes create
           * StockAdjustmentLog rows. Once that happens, deleting
           * the original purchase is no longer a safe reversal.
           */
          const laterAdjustments =
            await tx.stockAdjustmentLog.count({
              where: {
                medicineId:
                  inventory.id,

                createdAt: {
                  gte:
                    purchase.createdAt,
                },
              },
            });


          if (
            laterAdjustments > 0
          ) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: stock for '${item.medicineName}' was adjusted or returned after this purchase.`
            );
          }


          const inventoryUnitsPerPack = Math.max(
            1,
            Number(inventory.unitPerPack || 1)
          );

          if (Number(item.unitsPerPack || inventoryUnitsPerPack) !== inventoryUnitsPerPack) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: units-per-pack metadata for '${item.medicineName}' no longer matches the linked inventory batch.`
            );
          }

          const purchasedTotalUnits =
            purchasedPacks * inventoryUnitsPerPack + purchasedLoose;
          const currentTotalUnits =
            inventory.packInStock * inventoryUnitsPerPack + inventory.unitInStock;

          if (currentTotalUnits < purchasedTotalUnits) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: insufficient remaining stock for '${item.medicineName}'. Available: ${currentTotalUnits} total units; required to reverse: ${purchasedTotalUnits}.`
            );
          }

          const remainingTotalUnits = currentTotalUnits - purchasedTotalUnits;
          const newPackStock = Math.floor(remainingTotalUnits / inventoryUnitsPerPack);
          const newLooseStock = remainingTotalUnits % inventoryUnitsPerPack;

          /*
           * Historical BillItem records reference inventory.
           * Keep a zero-stock inventory row if old sales exist.
           */
          const historicalSales =
            await tx.billItem.count({
              where: {
                inventoryId:
                  inventory.id,
              },
            });


          /*
           * Do not assume a zero-stock inventory row was created
           * by this purchase.
           *
           * A pre-existing batch may have had zero stock before
           * the purchase. Deleting that row during cancellation
           * would destroy metadata that existed beforehand.
           */
          const otherPurchaseLinks =
            await tx.purchaseInvoiceItem.count({
              where: {
                inventoryId:
                  inventory.id,

                invoiceId: {
                  not:
                    purchase.id,
                },
              },
            });


          const purchaseCreationNote =
            `Purchased via Inward Invoice #${purchase.invoiceNumber}`;


          const createdByThisPurchase =
            String(
              inventory.notes ||
              ""
            ).trim() ===
              purchaseCreationNote &&
            inventory.createdAt >=
              purchase.createdAt;


          const canDeleteInventoryRow =
            newPackStock === 0 &&
            newLooseStock === 0 &&
            historicalSales === 0 &&
            otherPurchaseLinks === 0 &&
            createdByThisPurchase;


          if (
            canDeleteInventoryRow
          ) {
            await tx.inventory.delete({
              where: {
                id:
                  inventory.id,
              },
            });
          }
          else {
            /*
             * Quantity reversal only.
             *
             * Existing batch metadata remains intact.
             */
            await tx.inventory.update({
              where: {
                id:
                  inventory.id,
              },

              data: {
                packInStock:
                  newPackStock,

                unitInStock:
                  newLooseStock,
              },
            });
          }
        }


        /*
         * Only now is it safe to reverse the credit liability.
         * Do NOT clamp the balance to zero; a negative supplier
         * balance can represent a legitimate advance/overpayment.
         */
        if (
          purchase.paymentMode
            .toLowerCase() ===
            "credit"
        ) {
          const distributor =
            await tx.distributor.findUnique({
              where: {
                id:
                  purchase.distributorId,
              },
            });


          if (!distributor) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: distributor record no longer exists.`
            );
          }


          await tx.distributor.update({
            where: {
              id: distributor.id,
            },
            data: {
              currentBalance: {
                decrement: Number(purchase.grandTotal || 0),
              },
            },
          });
        }


        /*
         * Delete only ledger rows belonging to this purchase.
         */
        await tx.ledger.deleteMany({
          where: {
            OR: [
              {
                invoiceId:
                  purchase.id,
              },

              {
                AND: [
                  {
                    distributorId:
                      purchase.distributorId,
                  },

                  {
                    referenceNo:
                      purchase.invoiceNumber,
                  },

                  {
                    ledgerType:
                      "purchase",
                  },
                ],
              },
            ],
          },
        });


        const purchaseSnapshot = JSON.parse(JSON.stringify(purchase));

        await tx.purchaseCancellationLog.create({
          data: {
            purchaseId: purchase.id,
            invoiceNumber: purchase.invoiceNumber,
            distributorId: purchase.distributorId,
            paymentMode: purchase.paymentMode,
            grandTotal: purchase.grandTotal,
            reason: cancellationReason || null,
            cancelledBy,
            purchaseSnapshot,
          },
        });


        await tx.purchaseInvoiceItem.deleteMany({
          where: {
            invoiceId:
              purchase.id,
          },
        });


        await tx.purchaseInvoice.delete({
          where: {
            id:
              purchase.id,
          },
        });
      }
    );


    res.status(200).json({
      success: true,

      message:
        `Purchase invoice #${purchase.invoiceNumber} cancelled safely. Stock and supplier ledger were reverted.`,
    });
  } catch (error) {
    if (
      error instanceof
      PurchaseCancellationConflictError
    ) {
      res.status(409).json({
        success: false,
        message:
          error.message,
      });

      return;
    }


    console.error(
      "Error cancelling purchase invoice:",
      error
    );


    res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel purchase invoice.",
    });
  }
};

