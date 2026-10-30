import { Request, Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { formatMedicineCode, parseIdParam } from "../utils/id.helpers.js";

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

type AuthoritativeSaleItem = {
  inventoryId: number;
  isLoose: boolean;
  quantity: number;
  unitsPerPack: number;
  packPrice: number;
  grossLineAmount: number;
  discountShare: number;
  netLineAmount: number;
  vatAmount: number;
  taxBase: number;
  isVatApplicable: boolean;
};

type AuthoritativeSaleFinancials = {
  items: AuthoritativeSaleItem[];
  grossSubtotal: number;
  discountAmount: number;
  vatExemptSubtotal: number;
  taxableBaseSubtotal: number;
  vatAmount: number;
  grandTotal: number;
};

const buildAuthoritativeSaleFinancials = async (
  rawItems: any[],
  discountTypeInput: unknown,
  discountValueInput: unknown,
  legacyDiscountAmountInput: unknown
): Promise<AuthoritativeSaleFinancials> => {
  const normalizedItems: AuthoritativeSaleItem[] = [];

  for (const item of rawItems) {
    const inventoryId = parseIdParam(
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

    const inventory =
      await prisma.inventory.findUnique({
        where: { id: inventoryId },
      });

    if (!inventory) {
      throw new Error(
        `Medicine not found in inventory (ID: ${inventoryId})`
      );
    }

    const quantity = Number.parseInt(
      String(item.quantity ?? ""),
      10
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invalid sale quantity for '${inventory.medicineBrand}'.`
      );
    }

    const unitsPerPack = Math.max(
      1,
      inventory.unitPerPack || 10
    );

    const packPrice = Number(
      inventory.sellingPrice
    );

    if (
      !Number.isFinite(packPrice) ||
      packPrice < 0
    ) {
      throw new Error(
        `Invalid selling price for '${inventory.medicineBrand}'.`
      );
    }

    const isLoose = Boolean(
      item.isLooseUnit
    );

    const unitPrice = isLoose
      ? packPrice / unitsPerPack
      : packPrice;

    const grossLineAmount = roundMoney(
      unitPrice * quantity
    );

    normalizedItems.push({
      inventoryId,
      isLoose,
      quantity,
      unitsPerPack,
      packPrice: roundMoney(packPrice),
      grossLineAmount,
      discountShare: 0,
      netLineAmount:
        grossLineAmount,
      vatAmount: 0,
      taxBase: 0,
      isVatApplicable:
        Boolean(inventory.hasvat),
    });
  }

  const grossSubtotal = roundMoney(
    normalizedItems.reduce(
      (sum, item) =>
        sum + item.grossLineAmount,
      0
    )
  );

  const discountType =
    String(
      discountTypeInput || "flat"
    )
      .trim()
      .toLowerCase() ===
    "percent"
      ? "percent"
      : "flat";

  const rawDiscountValue = Number(
    discountValueInput ??
    legacyDiscountAmountInput ??
    0
  );

  if (
    !Number.isFinite(
      rawDiscountValue
    ) ||
    rawDiscountValue < 0
  ) {
    throw new Error(
      "Discount must be zero or a positive number."
    );
  }

  if (
    discountType ===
      "percent" &&
    rawDiscountValue > 100
  ) {
    throw new Error(
      "Percentage discount cannot exceed 100%."
    );
  }

  let discountAmount =
    discountType ===
    "percent"
      ? roundMoney(
          grossSubtotal *
            rawDiscountValue /
            100
        )
      : roundMoney(
          Math.min(
            grossSubtotal,
            rawDiscountValue
          )
        );

  discountAmount = Math.min(
    grossSubtotal,
    Math.max(
      0,
      discountAmount
    )
  );

  let remainingDiscount =
    discountAmount;

  let vatExemptSubtotal = 0;
  let taxableBaseSubtotal = 0;
  let vatAmount = 0;

  normalizedItems.forEach(
    (item, index) => {
      const isLastLine =
        index ===
        normalizedItems.length - 1;

      const proportionalDiscount =
        grossSubtotal > 0
          ? roundMoney(
              discountAmount *
                item.grossLineAmount /
                grossSubtotal
            )
          : 0;

      const lineDiscount =
        Math.min(
          item.grossLineAmount,
          remainingDiscount,
          isLastLine
            ? remainingDiscount
            : proportionalDiscount
        );

      remainingDiscount =
        roundMoney(
          Math.max(
            0,
            remainingDiscount -
              lineDiscount
          )
        );

      item.discountShare =
        lineDiscount;

      item.netLineAmount =
        roundMoney(
          item.grossLineAmount -
            lineDiscount
        );

      if (
        item.isVatApplicable
      ) {
        item.taxBase =
          roundMoney(
            item.netLineAmount /
              1.13
          );

        item.vatAmount =
          roundMoney(
            item.netLineAmount -
              item.taxBase
          );

        taxableBaseSubtotal +=
          item.taxBase;

        vatAmount +=
          item.vatAmount;
      } else {
        vatExemptSubtotal +=
          item.netLineAmount;
      }
    }
  );

  vatExemptSubtotal =
    roundMoney(
      vatExemptSubtotal
    );

  taxableBaseSubtotal =
    roundMoney(
      taxableBaseSubtotal
    );

  vatAmount =
    roundMoney(vatAmount);

  const grandTotal =
    roundMoney(
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          item.netLineAmount,
        0
      )
    );

  return {
    items: normalizedItems,
    grossSubtotal,
    discountAmount,
    vatExemptSubtotal,
    taxableBaseSubtotal,
    vatAmount,
    grandTotal,
  };
};

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
    const quantity =
      isLoose
        ? bi.quantityInUnit
        : bi.quantityInPack;

    const returnedPacks =
      (bi.salesReturnItems || [])
        .reduce(
          (
            sum: number,
            item: any
          ) =>
            sum +
            Number(
              item.quantityInPack || 0
            ),
          0
        );

    const returnedUnits =
      (bi.salesReturnItems || [])
        .reduce(
          (
            sum: number,
            item: any
          ) =>
            sum +
            Number(
              item.quantityInUnit || 0
            ),
          0
        );

    const alreadyReturnedQuantity =
      isLoose
        ? returnedUnits
        : returnedPacks;

    const returnableQuantity =
      Math.max(
        0,
        Number(quantity || 0) -
          alreadyReturnedQuantity
      );

    const unitsPerPack =
      inv?.unitPerPack || 10;
    const packPrice = Number(bi.packPrice);
    const unitPrice = isLoose ? packPrice / unitsPerPack : packPrice;
    const grossLineTotal =
      Number(bi.grossItemPrice);

    const netLineTotal =
      Number(bi.netItemPrice);

    const hasVat =
      inv?.hasvat || false;

    const vatAmt =
      Number(bi.vatitemPrice);

    const taxBase = hasVat
      ? Math.max(
          0,
          netLineTotal - vatAmt
        )
      : 0;

    return {
      id: String(bi.id),
      billItemId: bi.id,
      inventoryId: bi.inventoryId,
      medicineId:
        formatMedicineCode(
          bi.inventoryId
        ),
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
      lineTotal:
        grossLineTotal,
      taxBase:
        roundMoney(taxBase),
      vatAmount: vatAmt,
    };
  });

  const grossSubtotal = Number(bill.subTotal);
  const vatAmount = Number(bill.vatAmount);
  const discountAmount = Number(bill.discountAmount);
  const grandTotal = Number(bill.grandTotal);

  const vatExemptSubtotal =
    roundMoney(
      (bill.items || [])
        .filter(
          (bi: any) =>
            !Boolean(
              bi.inventory?.hasvat
            )
        )
        .reduce(
          (
            sum: number,
            bi: any
          ) =>
            sum +
            Number(
              bi.netItemPrice ||
                0
            ),
          0
        )
    );

  const taxableBaseSubtotal =
    roundMoney(
      formattedItems
        .filter(
          (it: any) =>
            it.isVatApplicable
        )
        .reduce(
          (
            sum: number,
            it: any
          ) =>
            sum + it.taxBase,
          0
        )
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
      discountType,
      discountValue,
      discountAmount = 0,
      cashTendered,
      amountReceived,
      cashierId: inputCashierId,
    } = req.body;

    const cleanCustomerPhone = customerPhone ? String(customerPhone).trim() : "";
    const cleanCustomerPan = customerPan ? String(customerPan).trim() : "";
    if (cleanCustomerPhone && !/^\d{7,10}$/.test(cleanCustomerPhone)) {
      res.status(400).json({ success: false, message: "Customer phone number must contain between 7 and 10 digits." });
      return;
    }
    if (cleanCustomerPan && !/^\d{9}$/.test(cleanCustomerPan)) {
      res.status(400).json({ success: false, message: "Buyer PAN must contain exactly 9 digits." });
      return;
    }

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

    // Financial values are recalculated from PostgreSQL.
    // Browser-submitted subtotal, VAT and grand total are not trusted.
    const authoritativeFinancials =
      await buildAuthoritativeSaleFinancials(
        items,
        discountType,
        discountValue,
        discountAmount
      );

    const finalPaymentMethod =
      String(
        paymentMode ||
        paymentMethod ||
        "cash"
      )
        .trim()
        .toLowerCase();

    const requestedReceived =
      Number(
        cashTendered ??
        amountReceived ??
        authoritativeFinancials.grandTotal
      );

    if (
      !Number.isFinite(
        requestedReceived
      ) ||
      requestedReceived < 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Amount received must be zero or a positive number.",
      });
      return;
    }

    if (
      finalPaymentMethod ===
        "cash" &&
      requestedReceived + 0.001 <
        authoritativeFinancials.grandTotal
    ) {
      res.status(400).json({
        success: false,
        message:
          "Cash tendered is less than the grand total.",
      });
      return;
    }

    const calculatedReceived =
      finalPaymentMethod ===
      "cash"
        ? roundMoney(
            requestedReceived
          )
        : authoritativeFinancials.grandTotal;

    const calculatedChange =
      finalPaymentMethod ===
      "cash"
        ? roundMoney(
            Math.max(
              0,
              calculatedReceived -
                authoritativeFinancials.grandTotal
            )
          )
        : 0;

    // 3. Atomic Transaction: Create Bill + Items + Deduct Stock
    const createdBill = await prisma.$transaction(async (tx) => {
      // Create Master Bill record
      const bill = await tx.bill.create({
        data: {
          invoiceNumber: finalInvoiceNumber,
          customerName: customerName ? String(customerName).trim() : "Counter Patient",
          customerPhone: cleanCustomerPhone || null,
          customerPan: cleanCustomerPan || null,
          prescribingDoctor: (doctorName || prescribingDoctor) ? String(doctorName || prescribingDoctor).trim() : null,
          paymentMethod: finalPaymentMethod,
          paymentStatus: "paid",
          subTotal:
            authoritativeFinancials.grossSubtotal,

          discountAmount:
            authoritativeFinancials.discountAmount,

          vatAmount:
            authoritativeFinancials.vatAmount,

          grandTotal:
            authoritativeFinancials.grandTotal,
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

      for (
        let itemIndex = 0;
        itemIndex < items.length;
        itemIndex += 1
      ) {
        const item =
          items[itemIndex];

        const authoritativeItem =
          authoritativeFinancials.items[
            itemIndex
          ];

        if (
          !item ||
          !authoritativeItem
        ) {
          throw new Error(
            "Sale item financial validation failed."
          );
        }

        const inventoryId =
          authoritativeItem.inventoryId;

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
          authoritativeItem.isLoose;

        const qty =
          authoritativeItem.quantity;

        const unitsPerPack =
          Math.max(
            1,
            selectedInventory.unitPerPack ||
              10
          );

        const currentPackPrice =
          roundMoney(
            Number(
              selectedInventory.sellingPrice
            )
          );

        if (
          unitsPerPack !==
            authoritativeItem.unitsPerPack ||
          Math.abs(
            currentPackPrice -
              authoritativeItem.packPrice
          ) > 0.001 ||
          Boolean(
            selectedInventory.hasvat
          ) !==
            authoritativeItem.isVatApplicable
        ) {
          throw new Error(
            `Medicine pricing or VAT settings changed for '${selectedInventory.medicineBrand}'. Refresh POS and retry.`
          );
        }

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
        // Use only server-calculated prices/tax values.
        // Browser-submitted line totals and VAT are not trusted.
        // ----------------------------------------------------

        const billItemPackPrice =
          authoritativeItem.packPrice;

        const totalGrossLineAmount =
          authoritativeItem.grossLineAmount;

        const totalNetLineAmount =
          authoritativeItem.netLineAmount;

        const totalVatAmount =
          authoritativeItem.vatAmount;

        let remainingQty = qty;

        let remainingGrossLineAmount =
          totalGrossLineAmount;

        let remainingNetLineAmount =
          totalNetLineAmount;

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

          const allocatedGrossLineAmount =
            isFinalAllocation
              ? remainingGrossLineAmount
              : roundMoney(
                  totalGrossLineAmount *
                    allocatedQty /
                    qty
                );

          const allocatedNetLineAmount =
            isFinalAllocation
              ? remainingNetLineAmount
              : roundMoney(
                  totalNetLineAmount *
                    allocatedQty /
                    qty
                );

          const allocatedVatAmount =
            isFinalAllocation
              ? remainingVatAmount
              : roundMoney(
                  totalVatAmount *
                    allocatedQty /
                    qty
                );

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
                allocatedGrossLineAmount,

              netItemPrice:
                allocatedNetLineAmount,
            },
          });

          remainingQty -=
            allocatedQty;

          remainingGrossLineAmount =
            roundMoney(
              remainingGrossLineAmount -
                allocatedGrossLineAmount
            );

          remainingNetLineAmount =
            roundMoney(
              remainingNetLineAmount -
                allocatedNetLineAmount
            );

          remainingVatAmount =
            roundMoney(
              remainingVatAmount -
                allocatedVatAmount
            );
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
              salesReturnItems: true,
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
              salesReturnItems: true,
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
              salesReturnItems: true,
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
              salesReturnItems: true,
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

// ==========================================
// 5. CUSTOMER SALES RETURN / REFUND
// ==========================================
export const returnBillItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const param = String(req.params.id || "").trim();
    const id = parseInt(param, 10);
    const { items: rawItems, returnedItems: rawReturnedItems, notes, reason } = req.body;
    const incomingList = rawReturnedItems || rawItems;

    if (!Array.isArray(incomingList) || incomingList.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one item to return must be specified.",
      });
      return;
    }

    const items = incomingList.map((item: any) => ({
      ...item,
      quantityInPack: item.quantityInPack ?? item.quantityPacks ?? 0,
      quantityInUnit: item.quantityInUnit ?? item.quantityLoose ?? 0,
    }));

    const bill = await prisma.bill.findFirst({
      where: isNaN(id) ? { invoiceNumber: param } : { OR: [{ id }, { invoiceNumber: param }] },
      include: {
        items: {
          include: {
              salesReturnItems: true,
            inventory: true,
          },
        },
        salesReturns: true,
      },
    });

    if (!bill) {
      res.status(404).json({
        success: false,
        message: `Bill '${param}' not found.`,
      });
      return;
    }

    const user = (req as any).user;
    const recordedBy = user?.username ? `${user.firstName || user.username} (@${user.username})` : "Pharmacist";

    const returnResult = await prisma.$transaction(async (tx) => {
      // Generate unique Credit Note Number
      const fiscalYear = "2081/82";
      const countReturns = await tx.salesReturn.count();
      const creditNoteNumber = `CN-${fiscalYear}-${String(countReturns + 1).padStart(5, "0")}`;

      let totalRefundAmount = 0;
      const validatedItems: Array<{
        lineItem: any;
        returnPacks: number;
        returnUnits: number;
        lineRefund: number;
      }> = [];

      for (const ret of items) {
        const lineItem = bill.items.find(
          (it) => (ret.billItemId && it.id === Number(ret.billItemId)) || (ret.inventoryId && it.inventoryId === Number(ret.inventoryId))
        );

        if (!lineItem) {
          throw new Error(`Item with ID ${ret.billItemId || ret.inventoryId} not found on this invoice.`);
        }

        const returnPacks = Math.max(0, parseInt(String(ret.quantityInPack || 0), 10));
        const returnUnits = Math.max(0, parseInt(String(ret.quantityInUnit || 0), 10));

        if (returnPacks === 0 && returnUnits === 0) continue;

        // Calculate already returned quantities
        const alreadyReturnedPacks = (lineItem.salesReturnItems || []).reduce(
          (sum: number, r: any) => sum + Number(r.quantityInPack || 0),
          0
        );
        const alreadyReturnedUnits = (lineItem.salesReturnItems || []).reduce(
          (sum: number, r: any) => sum + Number(r.quantityInUnit || 0),
          0
        );

        const returnablePacks = Math.max(0, lineItem.quantityInPack - alreadyReturnedPacks);
        const returnableUnits = Math.max(0, lineItem.quantityInUnit - alreadyReturnedUnits);

        if (returnPacks > returnablePacks || returnUnits > returnableUnits) {
          throw new Error(
            `Return quantity (${returnPacks} pk, ${returnUnits} units) exceeds remaining returnable quantity (${returnablePacks} pk, ${returnableUnits} units) for ${lineItem.inventory?.medicineBrand || 'item'}.`
          );
        }

        // Calculate unit prices for refund
        const soldPacks =
          Number(
            lineItem.quantityInPack || 0
          );

        const soldUnits =
          Number(
            lineItem.quantityInUnit || 0
          );

        const soldQuantity =
          soldPacks > 0
            ? soldPacks
            : soldUnits;

        const returnedQuantity =
          soldPacks > 0
            ? returnPacks
            : returnUnits;

        if (soldQuantity <= 0) {
          throw new Error(
            "Cannot calculate refund for a zero-quantity bill line."
          );
        }

        /*
         * Refund from the NET amount actually paid.
         *
         * netItemPrice already contains the allocated
         * bill discount and VAT-inclusive final line value.
         * This prevents refunding an undiscounted amount
         * when the original customer received a discount.
         */
        const netLineAmount =
          Number(
            lineItem.netItemPrice || 0
          );

        const netPricePerSoldQuantity =
          netLineAmount /
          soldQuantity;

        const lineRefund =
          roundMoney(
            returnedQuantity *
              netPricePerSoldQuantity
          );

        totalRefundAmount += lineRefund;

        validatedItems.push({
          lineItem,
          returnPacks,
          returnUnits,
          lineRefund,
        });
      }

      if (validatedItems.length === 0) {
        throw new Error("No items were specified with a return quantity greater than 0.");
      }

      // 1. Create persistent SalesReturn record
      const salesReturn = await tx.salesReturn.create({
        data: {
          creditNoteNumber,
          invoiceId: bill.id,
          refundAmount: totalRefundAmount,
          reason: notes || reason || "Customer Sales Return",
          recordedBy,
        },
      });

      const returnedLineSummaries = [];

      for (const val of validatedItems) {
        const { lineItem, returnPacks, returnUnits, lineRefund } = val;

        // 2. Create SalesReturnItem record
        await tx.salesReturnItem.create({
          data: {
            returnId: salesReturn.id,
            billItemId: lineItem.id,
            inventoryId: lineItem.inventoryId,
            quantityInPack: returnPacks,
            quantityInUnit: returnUnits,
            refundAmount: lineRefund,
          },
        });

        // 3. Restock inventory directly to the exact sold batch
        const inv = lineItem.inventory;
        if (inv) {
          const currentTotalUnits = (inv.packInStock * inv.unitPerPack) + inv.unitInStock;
          const returnedTotalUnits = (returnPacks * inv.unitPerPack) + returnUnits;
          const newTotalUnits = currentTotalUnits + returnedTotalUnits;

          const updatedPackInStock = Math.floor(newTotalUnits / inv.unitPerPack);
          const updatedUnitInStock = newTotalUnits % inv.unitPerPack;

          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              packInStock: updatedPackInStock,
              unitInStock: updatedUnitInStock,
            },
          });

          // Log stock return
          await tx.stockAdjustmentLog.create({
            data: {
              medicineId: inv.id,
              adjustmentType: "CORRECTION",
              previousPacks: inv.packInStock,
              newPacks: updatedPackInStock,
              variancePacks: returnPacks,
              previousLooseUnits: inv.unitInStock,
              newLooseUnits: updatedUnitInStock,
              varianceLooseUnits: returnUnits,
              reason: `Customer Sales Return (Credit Note #${creditNoteNumber}, Inv #${bill.invoiceNumber}): ${notes || reason || 'Medicine return'}`,
              recordedBy,
            },
          });
        }

        returnedLineSummaries.push({
          medicineName: inv?.medicineBrand || "Medicine",
          batchNumber: inv?.batchNumber || "—",
          returnedPacks: returnPacks,
          returnedUnits: returnUnits,
          refundAmount: lineRefund,
        });
      }

      return {
        creditNoteNumber,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
        items: returnedLineSummaries,
      };
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed customer return. Credit Note #${returnResult.creditNoteNumber}. Total Refund: NPR ${returnResult.totalRefundAmount}. Stock restocked.`,
      data: {
        creditNoteNumber: returnResult.creditNoteNumber,
        invoiceNumber: bill.invoiceNumber,
        originalGrandTotal: Number(bill.grandTotal),
        refundAmount: returnResult.totalRefundAmount,
        returnedItems: returnResult.items,
        notes: notes || reason || "Customer Sales Return",
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error processing sales return:", error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to process sales return.",
    });
  }
};

export const getAllSalesReturns = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const returns =
      await prisma.salesReturn.findMany({
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              customerName: true,
              customerPhone: true,
              grandTotal: true,
            },
          },

          items: {
            include: {
              inventory: {
                select: {
                  medicineBrand: true,
                  batchNumber: true,
                },
              },
            },
          },
        },

        orderBy: {
          returnDate: "desc",
        },
      });

    const data =
      returns.map((sr) => ({
        id: sr.id,
        creditNoteNumber:
          sr.creditNoteNumber,

        invoiceId:
          sr.invoiceId,

        invoiceNumber:
          sr.invoice.invoiceNumber,

        customerName:
          sr.invoice.customerName ||
          "Counter Customer",

        customerPhone:
          sr.invoice.customerPhone ||
          undefined,

        originalInvoiceTotal:
          Number(
            sr.invoice.grandTotal
          ),

        returnDate:
          sr.returnDate.toISOString(),

        refundAmount:
          Number(
            sr.refundAmount
          ),

        reason:
          sr.reason ||
          undefined,

        recordedBy:
          sr.recordedBy ||
          undefined,

        invoice: {
          id:
            sr.invoice.id,

          invoiceNumber:
            sr.invoice.invoiceNumber,

          customerName:
            sr.invoice.customerName ||
            "Counter Customer",

          customerPhone:
            sr.invoice.customerPhone ||
            undefined,

          totalAmount:
            Number(
              sr.invoice.grandTotal
            ),
        },

        items:
          sr.items.map((item) => ({
            id:
              item.id,

            medicineName:
              item.inventory
                .medicineBrand,

            batchNumber:
              item.inventory
                .batchNumber,

            quantityInPack:
              item.quantityInPack,

            quantityInUnit:
              item.quantityInUnit,

            refundAmount:
              Number(
                item.refundAmount
              ),

            inventory: {
              brandName:
                item.inventory
                  .medicineBrand,

              batchNumber:
                item.inventory
                  .batchNumber,
            },
          })),
      }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error(
      "Error fetching sales returns:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve customer sales returns.",
    });
  }
};
