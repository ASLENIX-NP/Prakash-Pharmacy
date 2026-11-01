import { Request, Response } from "express";
import { prisma } from "../db.js";
import {
  parseNepalDateBoundary,
} from "../utils/nepal-time.js";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export async function getVatReportSummary(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // ── Date-range filter ──────────────────────────────────────────────────
    // Accept ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (ISO date strings).
    // If omitted the query covers ALL time (backward-compatible).
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const start =
      startDate
        ? parseNepalDateBoundary(
            startDate,
            false
          )
        : null;

    if (startDate && !start) {
      res.status(400).json({
        success: false,
        message: "Invalid VAT report start date.",
      });
      return;
    }

    const end =
      endDate
        ? parseNepalDateBoundary(
            endDate,
            true
          )
        : null;

    if (endDate && !end) {
      res.status(400).json({
        success: false,
        message: "Invalid VAT report end date.",
      });
      return;
    }

    if (
      start &&
      end &&
      start.getTime() > end.getTime()
    ) {
      res.status(400).json({
        success: false,
        message:
          "VAT report start date cannot be after end date.",
      });
      return;
    }

    // Prisma `where` fragments — only add date filter when dates are given.
    const billDateWhere =
      start || end
        ? {
            transactionDate: {
              ...(start ? { gte: start } : {}),
              ...(end   ? { lte: end   } : {}),
            },
          }
        : {};

    const purchaseDateWhere =
      start || end
        ? {
            purchaseDate: {
              ...(start ? { gte: start } : {}),
              ...(end   ? { lte: end   } : {}),
            },
          }
        : {};

    const returnDateWhere =
      start || end
        ? {
            returnDate: {
              ...(start ? { gte: start } : {}),
              ...(end   ? { lte: end   } : {}),
            },
          }
        : {};
    // ──────────────────────────────────────────────────────────────────────

    const distributorReturnDateWhere =
      start || end
        ? {
            date: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {};

    const [
      bills,
      purchases,
      inventory,
      salesReturns,
      distributorReturns,
    ] =
      await Promise.all([
        prisma.bill.findMany({
          where: billDateWhere,
          select: {
            subTotal: true,
            discountAmount: true,
            vatAmount: true,
            grandTotal: true,
            items: {
              select: {
                netItemPrice: true,
                vatitemPrice: true,
                hasVatSnapshot: true,
                inventory: {
                  select: {
                    hasvat: true,
                  },
                },
              },
            },
          },
        }),

        prisma.purchaseInvoice.findMany({
          where: purchaseDateWhere,
          select: {
            subtotal: true,
            discountAmount: true,
            taxableAmount: true,
            vatAmount: true,
            grandTotal: true,
            items: {
              select: {
                lineTotal: true,
                isVatApplicable: true,
              },
            },
          },
        }),

        // Inventory valuation is always current stock snapshot — no date filter.
        prisma.inventory.findMany({
          select: {
            packInStock: true,
            unitInStock: true,
            unitPerPack: true,
            costPrice: true,
            sellingPrice: true,
          },
        }),

        prisma.salesReturn.findMany({
          where: returnDateWhere,
          select: {
            refundAmount: true,
            items: {
              select: {
                refundAmount: true,
                billItem: {
                  select: {
                    netItemPrice: true,
                    vatitemPrice: true,
                    hasVatSnapshot: true,
                    inventory: {
                      select: {
                        hasvat: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.distributorReturn.findMany({
          where: distributorReturnDateWhere,
          select: {
            items: true,
          },
        }),
      ]);

    /* ==========================================
       SALES
       ========================================== */

    let totalSalesGross = 0;
    let totalSalesDiscount = 0;
    let netSales = 0;
    let outputVat = 0;

    let salesWithoutVat = 0;
    let taxableSalesBase = 0;

    for (const bill of bills) {
      totalSalesGross +=
        toNumber(bill.subTotal);

      totalSalesDiscount +=
        toNumber(bill.discountAmount);

      netSales +=
        toNumber(bill.grandTotal);

      outputVat +=
        toNumber(bill.vatAmount);

      for (const item of bill.items) {
        const lineNet =
          toNumber(item.netItemPrice);

        const lineVat =
          toNumber(item.vatitemPrice);

        /*
         * vatitemPrice is the historical VAT recorded
         * on the bill item. inventory.hasvat is retained
         * as a fallback for older rows.
         */
        const isTaxable =
          lineVat > 0 ||
          Boolean(
            item.hasVatSnapshot ??
            item.inventory.hasvat
          );

        if (isTaxable) {
          taxableSalesBase +=
            Math.max(
              0,
              lineNet - lineVat
            );
        } else {
          salesWithoutVat +=
            lineNet;
        }
      }
    }

    // Persisted credit notes reverse the sale amounts. Use the original
    // bill-line VAT split so later inventory edits cannot rewrite history.
    for (const salesReturn of salesReturns) {
      netSales -= toNumber(salesReturn.refundAmount);

      for (const item of salesReturn.items) {
        const refund = toNumber(item.refundAmount);
        const lineNet = toNumber(item.billItem.netItemPrice);
        const lineVat = toNumber(item.billItem.vatitemPrice);
        const isTaxable =
          lineVat > 0 ||
          Boolean(
            item.billItem.hasVatSnapshot ??
            item.billItem.inventory.hasvat
          );

        if (isTaxable && lineNet > 0) {
          const vatRefund = Math.min(
            refund,
            refund * lineVat / lineNet
          );
          outputVat -= vatRefund;
          taxableSalesBase -= Math.max(0, refund - vatRefund);
        } else {
          salesWithoutVat -= refund;
        }
      }
    }

    netSales = roundMoney(netSales);
    outputVat = roundMoney(outputVat);
    taxableSalesBase = roundMoney(taxableSalesBase);
    salesWithoutVat = roundMoney(salesWithoutVat);

    const salesWithVat =
      taxableSalesBase + outputVat;


    /* ==========================================
       PURCHASES
       ========================================== */

    let totalPurchaseGross = 0;
    let totalPurchaseDiscount = 0;
    let totalPurchases = 0;
    let inputVat = 0;

    let purchaseWithoutVat = 0;
    let taxablePurchaseBase = 0;

    for (const purchase of purchases) {
      totalPurchaseGross +=
        toNumber(purchase.subtotal);

      totalPurchaseDiscount +=
        toNumber(purchase.discountAmount);

      totalPurchases +=
        toNumber(purchase.grandTotal);

      inputVat +=
        toNumber(purchase.vatAmount);

      /*
       * Purchase item lineTotal is the persisted
       * purchase amount after item discount and
       * before invoice VAT.
       */
      for (const item of purchase.items) {
        const lineTotal =
          toNumber(item.lineTotal);

        if (item.isVatApplicable) {
          taxablePurchaseBase +=
            lineTotal;
        } else {
          purchaseWithoutVat +=
            lineTotal;
        }
      }
    }

    /*
     * Prefer the persisted invoice taxable total
     * when it contains a value. This keeps old
     * purchase invoices compatible.
     */
    const storedTaxablePurchaseBase =
      purchases.reduce(
        (sum, purchase) =>
          sum +
          toNumber(
            purchase.taxableAmount
          ),
        0
      );

    if (
      storedTaxablePurchaseBase > 0 ||
      taxablePurchaseBase === 0
    ) {
      taxablePurchaseBase =
        storedTaxablePurchaseBase;
    }

    /*
     * Supplier debit notes reverse purchase value and input VAT
     * in the period in which the supplier return occurs.
     *
     * Only accounting-safe return rows created from an original
     * PurchaseInvoiceItem contain netPurchaseBase. Older legacy
     * rows are deliberately not reconstructed from current stock
     * prices because that could rewrite historical VAT incorrectly.
     */
    for (const supplierReturn of distributorReturns) {
      const returnedItems =
        Array.isArray(
          supplierReturn.items
        )
          ? supplierReturn.items
          : [];

      for (const rawItem of returnedItems) {
        if (
          !rawItem ||
          typeof rawItem !== "object" ||
          Array.isArray(rawItem)
        ) {
          continue;
        }

        const item =
          rawItem as Record<
            string,
            unknown
          >;

        /*
         * This field identifies a new accounting-safe supplier
         * return produced from the historical purchase invoice.
         */
        if (
          !Object.prototype.hasOwnProperty.call(
            item,
            "netPurchaseBase"
          )
        ) {
          continue;
        }

        const returnedBase =
          toNumber(
            item.netPurchaseBase
          );

        const returnedVat =
          toNumber(
            item.vatAmount
          );

        const isTaxableReturn =
          item.isVatApplicable === true ||
          returnedVat > 0;

        /*
         * Reverse the net purchase amount represented by this
         * debit-note row.
         */
        totalPurchases -=
          returnedBase +
          returnedVat;

        if (isTaxableReturn) {
          taxablePurchaseBase -=
            returnedBase;

          inputVat -=
            returnedVat;
        } else {
          purchaseWithoutVat -=
            returnedBase;
        }
      }
    }

    totalPurchases =
      roundMoney(
        totalPurchases
      );

    taxablePurchaseBase =
      roundMoney(
        taxablePurchaseBase
      );

    purchaseWithoutVat =
      roundMoney(
        purchaseWithoutVat
      );

    inputVat =
      roundMoney(
        inputVat
      );

    const purchaseWithVat =
      taxablePurchaseBase + inputVat;


    /* ==========================================
       VAT LIABILITY
       ========================================== */

    const vatDifference =
      outputVat - inputVat;

    const netVatPayable =
      Math.max(0, vatDifference);

    const vatCredit =
      Math.max(0, -vatDifference);


    /* ==========================================
       CURRENT INVENTORY VALUATION
       ========================================== */

    let stockAtCost = 0;
    let stockAtMrp = 0;
    let totalPacks = 0;
    let totalLooseUnits = 0;

    for (const item of inventory) {
      const unitsPerPack =
        Math.max(
          1,
          toNumber(item.unitPerPack)
        );

      const packs =
        toNumber(item.packInStock);

      const looseUnits =
        toNumber(item.unitInStock);

      const costPrice =
        toNumber(item.costPrice);

      const sellingPrice =
        toNumber(item.sellingPrice);

      totalPacks += packs;
      totalLooseUnits += looseUnits;

      stockAtCost +=
        packs * costPrice +
        looseUnits *
          (costPrice / unitsPerPack);

      stockAtMrp +=
        packs * sellingPrice +
        looseUnits *
          (sellingPrice / unitsPerPack);
    }


    res.status(200).json({
      success: true,
      data: {
        // Echoed back so the frontend can show "Showing period: X → Y"
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        sales: {
          totalGross: roundMoney(
            totalSalesGross
          ),
          discounts: roundMoney(
            totalSalesDiscount
          ),
          netSales: roundMoney(
            netSales
          ),
          withoutVat: roundMoney(
            salesWithoutVat
          ),
          taxableBase: roundMoney(
            taxableSalesBase
          ),
          withVat: roundMoney(
            salesWithVat
          ),
          outputVat: roundMoney(
            outputVat
          ),
        },

        purchases: {
          totalGross: roundMoney(
            totalPurchaseGross
          ),
          discounts: roundMoney(
            totalPurchaseDiscount
          ),
          totalPurchases: roundMoney(
            totalPurchases
          ),
          withoutVat: roundMoney(
            purchaseWithoutVat
          ),
          taxableBase: roundMoney(
            taxablePurchaseBase
          ),
          withVat: roundMoney(
            purchaseWithVat
          ),
          inputVat: roundMoney(
            inputVat
          ),
        },

        vat: {
          outputVat: roundMoney(
            outputVat
          ),
          inputVat: roundMoney(
            inputVat
          ),
          netPayable: roundMoney(
            netVatPayable
          ),
          credit: roundMoney(
            vatCredit
          ),
        },

        inventory: {
          stockAtCost: roundMoney(
            stockAtCost
          ),
          stockAtMrp: roundMoney(
            stockAtMrp
          ),
          totalPacks:
            Math.round(totalPacks),
          totalLooseUnits:
            Math.round(totalLooseUnits),
          medicineRows:
            inventory.length,
        },
      },
    });

  } catch (error) {
    console.error(
      "VAT report summary error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to calculate VAT report from database.",
    });
  }
}

// ---------------------------------------------------------------------------
// Full Data Backup
// ---------------------------------------------------------------------------
async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[Backup] Warning: Failed to query table "${name}":`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

export async function getFullBackup(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const [
      inventory,
      distributors,
      purchaseInvoices,
      bills,
      salesReturns,
      racks,
      categories,
      generics,
      settings,
      staff,
      doctors,
      clinicPatients,
      clinicVisits,
      stockAdjustmentLogs,
      ledger,
      distributorReturns,
      inventorySafetyStatusLogs,
      purchaseCancellationLogs,
    ] = await Promise.all([
      safeQuery("inventory", () => prisma.inventory.findMany(), []),
      safeQuery("distributor", () => prisma.distributor.findMany(), []),
      safeQuery("purchaseInvoice", () => prisma.purchaseInvoice.findMany({ include: { items: true } }), []),
      safeQuery("bill", () => prisma.bill.findMany({ include: { items: true } }), []),
      safeQuery("salesReturn", () => prisma.salesReturn.findMany({ include: { items: true } }), []),
      safeQuery("rack", () => prisma.rack.findMany(), []),
      safeQuery("category", () => prisma.category.findMany(), []),
      safeQuery("generic", () => prisma.generic.findMany(), []),
      safeQuery("pharmacySetting", () => prisma.pharmacySetting.findFirst(), null),
      safeQuery("user", () => prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, role: true, status: true, createdAt: true } }), []),
      safeQuery("doctor", () => prisma.doctor.findMany(), []),
      safeQuery("clinicPatient", () => prisma.clinicPatient.findMany(), []),
      safeQuery("clinicVisit", () => prisma.clinicVisit.findMany(), []),
      safeQuery("stockAdjustmentLog", () => prisma.stockAdjustmentLog.findMany(), []),
      safeQuery("ledger", () => prisma.ledger.findMany(), []),
      safeQuery("distributorReturn", () => prisma.distributorReturn.findMany(), []),
      safeQuery("inventorySafetyStatusLog", () => prisma.inventorySafetyStatusLog.findMany(), []),
      safeQuery("purchaseCancellationLog", () => prisma.purchaseCancellationLog.findMany(), []),
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "1.1",
      source: "Prakash Pharmacy ERP",
      tables: {
        inventory,
        distributors,
        purchaseInvoices,
        bills,
        salesReturns,
        racks,
        categories,
        generics,
        settings,
        staff,
        doctors,
        clinicPatients,
        clinicVisits,
        stockAdjustmentLogs,
        ledger,
        distributorReturns,
        inventorySafetyStatusLogs,
        purchaseCancellationLogs,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="prakash-pharmacy-backup-${new Date().toISOString().split("T")[0]}.json"`
    );
    res.status(200).json(backupData);
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate database backup.",
    });
  }
}
