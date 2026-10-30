import { Request, Response } from "express";
import { prisma } from "../db.js";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export async function getVatReportSummary(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const [bills, purchases, inventory, salesReturns] =
      await Promise.all([
        prisma.bill.findMany({
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
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
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
