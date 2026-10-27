import { Request, Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { formatMedicineCode, parseIdParam } from "../utils/id.helpers.js";

// Helper to format database bill row into rich frontend-compatible SaleInvoice
export const formatBillResponse = (bill: any) => {
  const dateObj = new Date(bill.transactionDate);
  const dateStr = dateObj.toISOString().split("T")[0];
  const timeStr = dateObj.toTimeString().split(" ")[0];

  const cashierDisplayName = bill.cashier
    ? `${bill.cashier.firstName} ${bill.cashier.lastName}`.trim()
    : "Cashier";

  const formattedItems = (bill.items || []).map((bi: any) => {
    const inv = bi.inventory;
    const isLoose = bi.quantityInUnit > 0 && bi.quantityInPack === 0;
    const quantity = isLoose ? bi.quantityInUnit : bi.quantityInPack;
    const unitsPerPack = inv?.unitPerPack || 10;
    const packPrice = Number(bi.packPrice);
    const unitPrice = isLoose ? packPrice / unitsPerPack : packPrice;
    const lineTotal = Number(bi.netItemPrice);
    const hasVat = inv?.hasvat || false;
    const vatAmt = Number(bi.vatitemPrice);
    const taxBase = hasVat ? Math.max(0, lineTotal - vatAmt) : 0;

    return {
      id: String(bi.id),
      medicineId: formatMedicineCode(bi.inventoryId),
      medicineName: inv?.medicineBrand || "Medicine",
      genericName: inv?.generic?.name || "Generic",
      category: inv?.category?.name || "Tablet",
      batchNumber: inv?.batchNumber || "N/A",
      expiryDate: inv?.expiryDate || "",
      isLooseUnit: isLoose,
      quantity,
      unitsPerPack,
      unitPrice: Math.round(unitPrice * 100) / 100,
      costPrice: Number(inv?.costPrice || 0),
      isVatApplicable: hasVat,
      rackLocation: inv?.rack?.name || "Unassigned",
      lineTotal,
      taxBase: Math.round(taxBase * 100) / 100,
      vatAmount: vatAmt,
    };
  });

  const grossSubtotal = Number(bill.subTotal);
  const vatAmount = Number(bill.vatAmount);
  const discountAmount = Number(bill.discountAmount);
  const grandTotal = Number(bill.grandTotal);

  const vatExemptSubtotal = Number(
    formattedItems
      .filter((it: any) => !it.isVatApplicable)
      .reduce((sum: number, it: any) => sum + it.lineTotal, 0)
      .toFixed(2)
  );

  const taxableBaseSubtotal = Number(
    formattedItems
      .filter((it: any) => it.isVatApplicable)
      .reduce((sum: number, it: any) => sum + it.taxBase, 0)
      .toFixed(2)
  );

  return {
    id: String(bill.id),
    billId: bill.id,
    invoiceNumber: bill.invoiceNumber,
    fiscalYear: "2081/82",
    date: dateStr,
    time: timeStr,
    customerName: bill.customerName || "Counter Customer",
    customerPhone: bill.customerPhone || undefined,
    customerPan: bill.customerPan || undefined,
    doctorName: bill.prescribingDoctor || undefined,
    paymentMode: bill.paymentMethod || "cash",
    paymentStatus: bill.paymentStatus || "paid",
    items: formattedItems,
    grossSubtotal,
    vatExemptSubtotal,
    taxableBaseSubtotal,
    vatAmount,
    discountType: "flat",
    discountValue: discountAmount,
    discountAmount,
    grandTotal,
    cashTendered: Number(bill.amountReceived),
    changeGiven: Number(bill.changeReturned),
    cashierName: cashierDisplayName,
    cashierId: bill.cashierId,
    createdAt: bill.transactionDate.toISOString(),
  };
};

// ==========================================
// 1. CREATE BILL / INVOICE (Checkout POS Sale)
// Atomically creates bill record, line items, and deducts inventory stock
// ==========================================
export const createBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      invoiceNumber: customInvoiceNumber,
      customerName,
      customerPhone,
      customerPan,
      doctorName,
      prescribingDoctor,
      paymentMode,
      paymentMethod,
      items,
      grossSubtotal,
      subTotal,
      discountAmount = 0,
      vatAmount = 0,
      grandTotal,
      cashTendered,
      amountReceived,
      changeGiven,
      changeReturned,
      cashierId: inputCashierId,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: "Bill must contain at least one medicine item.",
      });
      return;
    }

    // 1. Resolve Valid Cashier ID (foreign key guard)
    let finalCashierId = req.user?.id || inputCashierId;
    if (finalCashierId) {
      const cashierExists = await prisma.user.findUnique({
        where: { id: String(finalCashierId).trim() },
      });
      if (!cashierExists) {
        // Fall back to first active user if cashier ID not found
        const fallback = await prisma.user.findFirst({ where: { status: "active" } });
        finalCashierId = fallback ? fallback.id : "ADM-001";
      }
    } else {
      const fallback = await prisma.user.findFirst({ where: { status: "active" } });
      finalCashierId = fallback ? fallback.id : "ADM-001";
    }

    // 2. Generate Unique Invoice Number
    let finalInvoiceNumber = customInvoiceNumber?.trim();
    if (!finalInvoiceNumber) {
      const count = await prisma.bill.count();
      const seq = String(count + 101).padStart(5, "0");
      finalInvoiceNumber = `PP-2081/82-${seq}`;
    }

    // Ensure uniqueness if duplicate was sent
    const existing = await prisma.bill.findUnique({
      where: { invoiceNumber: finalInvoiceNumber },
    });
    if (existing) {
      const count = await prisma.bill.count();
      const seq = String(count + 1000 + Math.floor(Math.random() * 900)).padStart(5, "0");
      finalInvoiceNumber = `PP-2081/82-${seq}`;
    }

    // Calculations & Defaults
    const calculatedSubtotal = parseFloat(String(grossSubtotal ?? subTotal ?? 0)) || 0;
    const calculatedDiscount = parseFloat(String(discountAmount ?? 0)) || 0;
    const calculatedVat = parseFloat(String(vatAmount ?? 0)) || 0;
    const calculatedGrandTotal = parseFloat(String(grandTotal ?? (calculatedSubtotal - calculatedDiscount + calculatedVat))) || 0;
    const calculatedReceived = parseFloat(String(cashTendered ?? amountReceived ?? calculatedGrandTotal)) || calculatedGrandTotal;
    const calculatedChange = parseFloat(String(changeGiven ?? changeReturned ?? Math.max(0, calculatedReceived - calculatedGrandTotal))) || 0;
    const finalPaymentMethod = String(paymentMode || paymentMethod || "cash").toLowerCase();

    // 3. Atomic Transaction: Create Bill + Items + Deduct Stock
    const createdBill = await prisma.$transaction(async (tx) => {
      // Create Master Bill record
      const bill = await tx.bill.create({
        data: {
          invoiceNumber: finalInvoiceNumber,
          customerName: customerName ? String(customerName).trim() : "Counter Patient",
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          customerPan: customerPan ? String(customerPan).trim() : null,
          prescribingDoctor: (doctorName || prescribingDoctor) ? String(doctorName || prescribingDoctor).trim() : null,
          paymentMethod: finalPaymentMethod,
          paymentStatus: "paid",
          subTotal: calculatedSubtotal,
          discountAmount: calculatedDiscount,
          vatAmount: calculatedVat,
          grandTotal: calculatedGrandTotal,
          amountReceived: calculatedReceived,
          changeReturned: calculatedChange,
          cashierId: finalCashierId,
        },
      });

      // Process Line Items & Update Stock using FEFO
      // FEFO = First Expiry, First Out.
      // The selected inventory row identifies the medicine, but stock is
      // always consumed from the earliest non-expired matching batch first.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const parseExpiryForSale = (value: string): Date => {
        const text = String(value ?? "").trim();

        const ymd =
          /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

        if (ymd) {
          return new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3])
          );
        }

        return new Date(text);
      };

      for (const item of items) {
        const inventoryId =
          parseIdParam(
            item.medicineId ??
            item.inventoryId ??
            item.id
          );

        if (!inventoryId) {
          throw new Error(
            `Invalid medicine identifier: ${
              item.medicineId ||
              item.name ||
              "Unknown"
            }`
          );
        }

        const selectedInventory =
          await tx.inventory.findUnique({
            where: { id: inventoryId },
          });

        if (!selectedInventory) {
          throw new Error(
            `Medicine not found in inventory (ID: ${inventoryId})`
          );
        }

        const isLoose =
          Boolean(item.isLooseUnit);

        const qty =
          parseInt(
            String(item.quantity ?? 1),
            10
          ) || 1;

        if (qty <= 0) {
          throw new Error(
            `Invalid sale quantity for '${selectedInventory.medicineBrand}'.`
          );
        }

        const unitsPerPack =
          Math.max(
            1,
            selectedInventory.unitPerPack || 10
          );

        // ----------------------------------------------------
        // Find every batch of the same medicine.
        // Keep the same pack size so unlike pack formats are
        // never mixed into one sale allocation.
        // ----------------------------------------------------

        const candidateBatches =
          await tx.inventory.findMany({
            where: {
              medicineBrand: {
                equals:
                  selectedInventory.medicineBrand,
                mode: "insensitive",
              },

              unitPerPack:
                selectedInventory.unitPerPack,

              ...(selectedInventory.genericId
                ? {
                    genericId:
                      selectedInventory.genericId,
                  }
                : {}),
            },

            orderBy: [
              { expiryDate: "asc" },
              { id: "asc" },
            ],
          });

        // ----------------------------------------------------
        // Exclude expired / invalid / empty batches.
        // ----------------------------------------------------

        const validBatches =
          candidateBatches.filter(batch => {
            const expiry =
              parseExpiryForSale(
                batch.expiryDate
              );

            if (
              Number.isNaN(expiry.getTime()) ||
              expiry < todayStart
            ) {
              return false;
            }

            if (isLoose) {
              return (
                batch.packInStock *
                  batch.unitPerPack +
                  batch.unitInStock >
                0
              );
            }

            return batch.packInStock > 0;
          });

        // ----------------------------------------------------
        // Ensure the TOTAL non-expired stock is sufficient.
        // Do not silently clamp stock to zero.
        // ----------------------------------------------------

        const totalAvailable =
          validBatches.reduce(
            (sum, batch) => {
              if (isLoose) {
                return (
                  sum +
                  batch.packInStock *
                    batch.unitPerPack +
                  batch.unitInStock
                );
              }

              return (
                sum +
                batch.packInStock
              );
            },
            0
          );

        if (totalAvailable < qty) {
          throw new Error(
            `Insufficient non-expired stock for '${selectedInventory.medicineBrand}'. ` +
            `Requested ${qty} ${
              isLoose
                ? "unit(s)"
                : "pack(s)"
            }, but only ${totalAvailable} available.`
          );
        }

        // ----------------------------------------------------
        // Sale price remains the price shown to the customer.
        // Actual inventory allocation may span several batches.
        // ----------------------------------------------------

        const selectedPackPrice =
          Number(
            selectedInventory.sellingPrice
          );

        const requestedUnitPrice =
          item.unitPrice !== undefined
            ? Number(item.unitPrice)
            : Number.NaN;

        const effectiveUnitPrice =
          Number.isFinite(
            requestedUnitPrice
          )
            ? requestedUnitPrice
            : isLoose
              ? selectedPackPrice /
                unitsPerPack
              : selectedPackPrice;

        const billItemPackPrice =
          isLoose
            ? effectiveUnitPrice *
              unitsPerPack
            : effectiveUnitPrice;

        const totalVatAmount =
          parseFloat(
            String(
              item.vatAmount ?? 0
            )
          ) || 0;

        const totalLineAmount =
          parseFloat(
            String(
              item.lineTotal ??
              effectiveUnitPrice * qty
            )
          ) ||
          effectiveUnitPrice * qty;

        let remainingQty = qty;
        let remainingLineAmount =
          totalLineAmount;
        let remainingVatAmount =
          totalVatAmount;

        // ----------------------------------------------------
        // FEFO ALLOCATION
        // candidateBatches is expiry ASC, therefore earliest
        // valid expiry is always consumed first.
        // ----------------------------------------------------

        for (
          const batch of validBatches
        ) {
          if (remainingQty <= 0) {
            break;
          }

          const batchUnitsPerPack =
            Math.max(
              1,
              batch.unitPerPack || 10
            );

          const availableInBatch =
            isLoose
              ? batch.packInStock *
                  batchUnitsPerPack +
                batch.unitInStock
              : batch.packInStock;

          if (
            availableInBatch <= 0
          ) {
            continue;
          }

          const allocatedQty =
            Math.min(
              remainingQty,
              availableInBatch
            );

          let newPacks =
            batch.packInStock;

          let newLoose =
            batch.unitInStock;

          if (!isLoose) {
            newPacks =
              batch.packInStock -
              allocatedQty;
          } else {
            const totalUnits =
              batch.packInStock *
                batchUnitsPerPack +
              batch.unitInStock;

            const unitsAfterSale =
              totalUnits -
              allocatedQty;

            newPacks =
              Math.floor(
                unitsAfterSale /
                batchUnitsPerPack
              );

            newLoose =
              unitsAfterSale %
              batchUnitsPerPack;
          }

          await tx.inventory.update({
            where: {
              id: batch.id,
            },

            data: {
              packInStock:
                newPacks,

              unitInStock:
                newLoose,
            },
          });

          const isFinalAllocation =
            allocatedQty ===
            remainingQty;

          const allocatedLineAmount =
            isFinalAllocation
              ? remainingLineAmount
              : Math.round(
                  (
                    totalLineAmount *
                    allocatedQty /
                    qty
                  ) * 100
                ) / 100;

          const allocatedVatAmount =
            isFinalAllocation
              ? remainingVatAmount
              : Math.round(
                  (
                    totalVatAmount *
                    allocatedQty /
                    qty
                  ) * 100
                ) / 100;

          await tx.billItem.create({
            data: {
              invoiceId:
                bill.id,

              inventoryId:
                batch.id,

              quantityInPack:
                isLoose
                  ? 0
                  : allocatedQty,

              quantityInUnit:
                isLoose
                  ? allocatedQty
                  : 0,

              packPrice:
                billItemPackPrice,

              vatitemPrice:
                allocatedVatAmount,

              grossItemPrice:
                allocatedLineAmount,

              netItemPrice:
                allocatedLineAmount,
            },
          });

          remainingQty -=
            allocatedQty;

          remainingLineAmount =
            Math.round(
              (
                remainingLineAmount -
                allocatedLineAmount
              ) * 100
            ) / 100;

          remainingVatAmount =
            Math.round(
              (
                remainingVatAmount -
                allocatedVatAmount
              ) * 100
            ) / 100;
        }

        if (remainingQty > 0) {
          throw new Error(
            `FEFO allocation failed for '${selectedInventory.medicineBrand}'.`
          );
        }
      }
      // Return fully populated bill with relations
      return tx.bill.findUnique({
        where: { id: bill.id },
        include: {
          cashier: true,
          items: {
            include: {
              inventory: {
                include: {
                  generic: true,
                  category: true,
                  rack: true,
                },
              },
            },
          },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: `Invoice ${createdBill?.invoiceNumber} generated and stock updated successfully.`,
      data: formatBillResponse(createdBill),
    });
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate sales bill.",
    });
  }
};

// ==========================================
// 2. GET ALL BILLS / SALES REGISTER
// Supports: search, date filter, cashier filter, pagination
// ==========================================
export const getAllBills = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      dateFilter,
      from,
      to,
      cashierId,
      paymentMethod,
      page = "1",
      limit = "50",
    } = req.query;

    const where: any = {};

    // 1. Search Query across invoice number, customer name, customer phone, prescribing doctor
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { prescribingDoctor: { contains: q, mode: "insensitive" } },
      ];
    }

    // 2. Date Filtering
    const now = new Date();
    if (dateFilter === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.transactionDate = { gte: startOfDay };
    } else if (dateFilter === "yesterday") {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      where.transactionDate = { gte: yesterdayStart, lt: yesterdayEnd };
    } else if (dateFilter === "7days") {
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      where.transactionDate = { gte: sevenDaysAgo };
    } else if (dateFilter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where.transactionDate = { gte: startOfMonth };
    } else if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(String(from));
      if (to) {
        const toDate = new Date(String(to));
        toDate.setHours(23, 59, 59, 999);
        where.transactionDate.lte = toDate;
      }
    }

    // 3. Cashier Filter
    if (cashierId && typeof cashierId === "string" && cashierId.trim()) {
      where.cashierId = cashierId.trim();
    }

    // 4. Payment Method Filter
    if (paymentMethod && typeof paymentMethod === "string" && paymentMethod.trim()) {
      where.paymentMethod = paymentMethod.trim().toLowerCase();
    }

    const isAll = limit === "all";
    const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
    const parsedLimit = isAll ? undefined : Math.max(1, parseInt(String(limit), 10) || 50);

    const [totalCount, rawBills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        include: {
          cashier: true,
          items: {
            include: {
              inventory: {
                include: {
                  generic: true,
                  category: true,
                  rack: true,
                },
              },
            },
          },
        },
        orderBy: { transactionDate: "desc" },
        skip: isAll ? undefined : (parsedPage - 1) * (parsedLimit || 50),
        take: isAll ? undefined : parsedLimit,
      }),
    ]);

    const formattedBills = rawBills.map(formatBillResponse);

    // Calculate aggregated metrics
    const totalRevenue = rawBills.reduce((sum, b) => sum + Number(b.grandTotal), 0);
    const totalVat = rawBills.reduce((sum, b) => sum + Number(b.vatAmount), 0);

    res.status(200).json({
      success: true,
      totalCount,
      page: parsedPage,
      limit: isAll ? "all" : parsedLimit,
      totalPages: isAll ? 1 : Math.ceil(totalCount / (parsedLimit || 50)),
      count: formattedBills.length,
      stats: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
      },
      data: formattedBills,
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve sales invoices.",
    });
  }
};

// ==========================================
// 3. GET SINGLE BILL BY ID OR INVOICE NUMBER
// ==========================================
export const getBillById = async (req: Request, res: Response): Promise<void> => {
  try {
    const param = String(req.params.id).trim();

    let bill = null;
    const parsedId = parseInt(param, 10);
    if (!isNaN(parsedId)) {
      bill = await prisma.bill.findUnique({
        where: { id: parsedId },
        include: {
          cashier: true,
          items: {
            include: {
              inventory: {
                include: {
                  generic: true,
                  category: true,
                  rack: true,
                },
              },
            },
          },
        },
      });
    }

    if (!bill) {
      bill = await prisma.bill.findUnique({
        where: { invoiceNumber: param },
        include: {
          cashier: true,
          items: {
            include: {
              inventory: {
                include: {
                  generic: true,
                  category: true,
                  rack: true,
                },
              },
            },
          },
        },
      });
    }

    if (!bill) {
      res.status(404).json({
        success: false,
        message: `Invoice '${param}' not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatBillResponse(bill),
    });
  } catch (error) {
    console.error("Error fetching bill by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve invoice details.",
    });
  }
};

// ==========================================
// 4. GET BILLING STATS & DAILY REVENUE METRICS
// ==========================================
export const getBillingSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const allBills = await prisma.bill.findMany({
      select: {
        id: true,
        grandTotal: true,
        vatAmount: true,
        subTotal: true,
        discountAmount: true,
        paymentMethod: true,
        transactionDate: true,
      },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalRevenue = 0;
    let totalVat = 0;
    let todayRevenue = 0;
    let todayBillsCount = 0;
    const paymentBreakdown: Record<string, number> = {
      cash: 0,
      fonepay_qr: 0,
      card: 0,
      credit: 0,
    };

    for (const b of allBills) {
      const grand = Number(b.grandTotal);
      totalRevenue += grand;
      totalVat += Number(b.vatAmount);

      if (b.transactionDate >= todayStart) {
        todayRevenue += grand;
        todayBillsCount++;
      }

      const method = (b.paymentMethod || "cash").toLowerCase();
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + grand;
    }

    res.status(200).json({
      success: true,
      data: {
        totalBillsCount: allBills.length,
        totalRevenueNPR: Math.round(totalRevenue * 100) / 100,
        totalVatNPR: Math.round(totalVat * 100) / 100,
        todayBillsCount,
        todayRevenueNPR: Math.round(todayRevenue * 100) / 100,
        paymentBreakdown,
      },
    });
  } catch (error) {
    console.error("Error generating billing summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate billing summary metrics.",
    });
  }
};
