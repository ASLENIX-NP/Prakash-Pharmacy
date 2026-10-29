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
  constructor(message: string) {
    super(message);
    this.name = "PurchaseValidationError";
  }
}


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
        const looseUnits = Math.max(0, parseInt(String(item.looseUnits ?? item.stockLooseUnits ?? item.unitInStock ?? 0), 10) || 0);
        const freePacks = Math.max(0, parseInt(String(item.freePacks ?? 0), 10) || 0);
        const totalPacksReceived = packQty + freePacks;
        const unitsPerPack = Math.max(1, parseInt(String(item.unitsPerPack ?? 10), 10) || 10);
        const costPrice = parseFloat(String(item.costPrice ?? 0)) || 0;
        const mrpPrice = parseFloat(String(item.mrpPrice ?? (costPrice * 1.3))) || (costPrice * 1.3);
        const discountPercent = parseFloat(String(item.discountPercent ?? 0)) || 0;
        const isVatApplicable = Boolean(item.isVatApplicable);

        const looseCost = unitsPerPack > 1 ? (costPrice / unitsPerPack) : costPrice;
        const grossLine = (packQty * costPrice) + (looseUnits * looseCost);
        const calculatedLine = Math.round(grossLine * (1 - discountPercent / 100) * 100) / 100;
        const lineTotal = parseFloat(String(item.lineTotal ?? calculatedLine)) || calculatedLine;

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

        // Check if an inventory batch with same brand, batch number, AND expiry date already exists for this distributor
        const existingInventory = await tx.inventory.findFirst({
          where: {
            medicineBrand: { equals: medicineName, mode: "insensitive" },
            batchNumber: { equals: batchNumber, mode: "insensitive" },
            ...(expiryDate ? { expiryDate: { equals: expiryDate, mode: "insensitive" } } : {}),
            OR: [
              { distributorId: targetDistributorId },
              { distributorId: null },
            ],
          },
        });

        let linkedInventoryId: number;

        if (existingInventory) {
          /*
           * EXISTING-BATCH SAFETY
           *
           * A later purchase may add quantity to an existing
           * batch, but must not overwrite that batch's metadata.
           *
           * Otherwise cancellation could subtract stock but
           * could not reliably restore the previous metadata.
           */
          const existingUnitsPerPack =
            Math.max(
              1,
              Number(
                existingInventory.unitPerPack ||
                1
              )
            );

          if (
            unitsPerPack !==
            existingUnitsPerPack
          ) {
            throw new PurchaseValidationError(
              `Cannot add purchase item '${medicineName}' batch '${batchNumber}' to the existing inventory batch because units per pack differ. Existing batch: ${existingUnitsPerPack}; purchase: ${unitsPerPack}. Use a separate batch/inventory record instead.`
            );
          }

          /*
           * QUANTITY ONLY.
           *
           * Preserve the existing batch's:
           * cost price, selling price, VAT flag, expiry,
           * distributor, rack, pack size, generic/category,
           * barcode and notes.
           */
          const updated =
            await tx.inventory.update({
              where: {
                id:
                  existingInventory.id,
              },

              data: {
                packInStock:
                  existingInventory.packInStock +
                  totalPacksReceived,

                unitInStock:
                  (
                    existingInventory.unitInStock ||
                    0
                  ) +
                  looseUnits,
              },
            });

          linkedInventoryId =
            updated.id;
        } else {
          // Create new batch inventory record (with packs and loose tabs)
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
    console.error(
      "Error creating purchase invoice:",
      error
    );

    const statusCode =
      error instanceof PurchaseValidationError
        ? 409
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


          if (
            inventory.packInStock <
              purchasedPacks ||
            inventory.unitInStock <
              purchasedLoose
          ) {
            throw new PurchaseCancellationConflictError(
              `Cannot cancel purchase #${purchase.invoiceNumber}: insufficient remaining stock for '${item.medicineName}'. Available: ${inventory.packInStock} packs + ${inventory.unitInStock} loose; required to reverse: ${purchasedPacks} packs + ${purchasedLoose} loose.`
            );
          }


          const newPackStock =
            inventory.packInStock -
            purchasedPacks;

          const newLooseStock =
            inventory.unitInStock -
            purchasedLoose;


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
            await tx.stockAdjustmentLog.deleteMany({
              where: {
                medicineId:
                  inventory.id,
              },
            });

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


          const newBalance =
            Number(
              distributor.currentBalance ||
                0
            ) -
            Number(
              purchase.grandTotal ||
                0
            );


          await tx.distributor.update({
            where: {
              id:
                distributor.id,
            },

            data: {
              currentBalance:
                newBalance,
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

