import { Request, Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { formatMedicineCode, parseIdParam } from "../utils/id.helpers.js";

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const getNepalFiscalYear = (at: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);

  const partNumber = (type: "year" | "month" | "day"): number =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  const year = partNumber("year");
  const month = partNumber("month");
  const day = partNumber("day");

  if (!year || !month || !day) {
    throw new Error("Unable to derive Nepal fiscal year from transaction date.");
  }

  // Nepal fiscal year starts on Shrawan 1 (July 16 for the
  // Gregorian boundary used by this application).
  const startedThisGregorianYear =
    month > 7 || (month === 7 && day >= 16);

  const startBsYear =
    year + (startedThisGregorianYear ? 57 : 56);

  return `${startBsYear}/${String((startBsYear + 1) % 100).padStart(2, "0")}`;
};

class BillValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BillValidationError";
    this.statusCode = statusCode;
  }
}

const parseStrictBoolean = (value: unknown, fieldName: string): boolean => {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return false;

  throw new BillValidationError(
    `${fieldName} must be a boolean.`
  );
};

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

    const quantity = Number(
      item.quantity
    );

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new BillValidationError(
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

    const isLoose = parseStrictBoolean(
      item.isLooseUnit,
      "isLooseUnit"
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
    throw new BillValidationError(
      "Discount must be zero or a positive number."
    );
  }

  if (
    discountType ===
      "percent" &&
    rawDiscountValue > 100
  ) {
    throw new BillValidationError(
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
      bi.unitsPerPackSnapshot ??
      inv?.unitPerPack ??
      10;
    const packPrice = Number(bi.packPrice);
    const unitPrice = isLoose ? packPrice / unitsPerPack : packPrice;
    const grossLineTotal =
      Number(bi.grossItemPrice);

    const netLineTotal =
      Number(bi.netItemPrice);

    const hasVat =
      bi.hasVatSnapshot ??
      inv?.hasvat ??
      false;

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
      medicineName:
        bi.medicineNameSnapshot ||
        inv?.medicineBrand ||
        "Medicine",
      genericName:
        bi.genericNameSnapshot ||
        inv?.generic?.name ||
        "Generic",
      category:
        bi.categoryNameSnapshot ||
        inv?.category?.name ||
        "Tablet",
      batchNumber:
        bi.batchNumberSnapshot ||
        inv?.batchNumber ||
        "N/A",
      expiryDate:
        bi.expiryDateSnapshot ||
        inv?.expiryDate ||
        "",
      isLooseUnit: isLoose,
      quantity,
      unitsPerPack,
      unitPrice: Math.round(unitPrice * 100) / 100,
      costPrice: Number(
        bi.costPriceSnapshot ??
        inv?.costPrice ??
        0
      ),
      isVatApplicable: hasVat,
      rackLocation:
        bi.rackLocationSnapshot ||
        inv?.rack?.name ||
        "Unassigned",
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
            !(
              bi.hasVatSnapshot ??
              bi.inventory?.hasvat ??
              false
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

  const fiscalYear =
    String(bill.invoiceNumber || "")
      .match(/(\d{4}\/\d{2})/)?.[1] ||
    "";

  return {
    id: String(bill.id),
    billId: bill.id,
    invoiceNumber: bill.invoiceNumber,
    fiscalYear,
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
      clientRequestId,
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

    // Automatic invoice numbers are issued atomically from PharmacySetting.
    // An explicit invoice number is still accepted for controlled integrations,
    // while normal POS retries use a separate durable client request ID.
    const requestedInvoiceNumber =
      customInvoiceNumber
        ? String(customInvoiceNumber).trim()
        : "";

    const cleanClientRequestId =
      clientRequestId === undefined || clientRequestId === null
        ? ""
        : String(clientRequestId).trim();

    if (cleanClientRequestId && cleanClientRequestId.length > 128) {
      throw new BillValidationError(
        "Client checkout request ID is too long."
      );
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

    const supportedPaymentMethods = new Set([
      "cash",
      "fonepay_qr",
      "card",
      "credit",
    ]);

    if (!supportedPaymentMethods.has(finalPaymentMethod)) {
      throw new BillValidationError(
        `Unsupported payment method '${finalPaymentMethod}'.`
      );
    }

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
    const billResult = await prisma.$transaction(async (tx) => {
      if (cleanClientRequestId) {
        const requestLockKey = `pos-checkout:${cleanClientRequestId}`;
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${requestLockKey}))
        `;

        const replayedBill = await tx.bill.findUnique({
          where: { clientRequestId: cleanClientRequestId },
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

        if (replayedBill) {
          return { bill: replayedBill, replayed: true };
        }
      }

      let finalInvoiceNumber = requestedInvoiceNumber;

      if (finalInvoiceNumber) {
        const existing = await tx.bill.findUnique({
          where: { invoiceNumber: finalInvoiceNumber },
          select: { id: true },
        });

        if (existing) {
          throw new BillValidationError(
            `Invoice '${finalInvoiceNumber}' already exists. Duplicate/replayed checkout was not recorded again.`,
            409
          );
        }
      } else {
        const currentFiscalYear = getNepalFiscalYear();

        const issued = await tx.$queryRaw<
          Array<{
            invoice_prefix: string;
            fiscal_year: string;
            issued_number: number;
          }>
        >`
          UPDATE pharmacy_settings_tbl
             SET fiscal_year = ${currentFiscalYear},
                 invoice_prefix = CASE
                   WHEN invoice_prefix ~ '[0-9]{4}/[0-9]{2}'
                   THEN regexp_replace(
                     invoice_prefix,
                     '[0-9]{4}/[0-9]{2}',
                     ${currentFiscalYear}
                   )
                   ELSE invoice_prefix
                 END,
                 next_invoice_number = next_invoice_number + 1
           WHERE id = (
             SELECT id
               FROM pharmacy_settings_tbl
              ORDER BY id ASC
              LIMIT 1
           )
          RETURNING invoice_prefix, fiscal_year,
                    next_invoice_number - 1 AS issued_number
        `;

        if (!issued[0]) {
          throw new BillValidationError(
            "Pharmacy settings must be configured before issuing an automatic invoice number.",
            500
          );
        }

        const prefix =
          String(issued[0].invoice_prefix || "").trim() ||
          `PP-${issued[0].fiscal_year}-`;

        finalInvoiceNumber =
          `${prefix}${String(Number(issued[0].issued_number)).padStart(5, "0")}`;
      }

      // Create Master Bill record
      const bill = await tx.bill.create({
        data: {
          invoiceNumber: finalInvoiceNumber,
          clientRequestId: cleanClientRequestId || null,
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

            include: {
              generic: true,
              category: true,
              rack: true,
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
        // Price/VAT compatibility for FEFO.
        //
        // The current invoice financial model prices a requested medicine
        // before FEFO allocation. Therefore every batch actually consumed
        // by this request must have the same price and VAT classification as
        // the selected row. If not, reject instead of charging one batch's
        // price/tax while physically consuming another batch.
        // ----------------------------------------------------

        let compatibilityRemaining = qty;

        for (const batch of validBatches) {
          if (compatibilityRemaining <= 0) break;

          const available = isLoose
            ? batch.packInStock * batch.unitPerPack + batch.unitInStock
            : batch.packInStock;

          if (available <= 0) continue;

          const batchPrice = roundMoney(Number(batch.sellingPrice));
          const priceMismatch =
            Math.abs(batchPrice - currentPackPrice) > 0.001;
          const vatMismatch =
            Boolean(batch.hasvat) !== Boolean(selectedInventory.hasvat);

          if (priceMismatch || vatMismatch) {
            throw new BillValidationError(
              `FEFO batch '${batch.batchNumber}' for '${selectedInventory.medicineBrand}' has a different selling price or VAT classification. Reconcile batch pricing/tax before checkout.`,
              409
            );
          }

          compatibilityRemaining -= Math.min(
            compatibilityRemaining,
            available
          );
        }

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
          throw new BillValidationError(
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

          if (!isLoose) {
            const changed =
              await tx.inventory.updateMany({
                where: {
                  id: batch.id,
                  packInStock: {
                    gte: allocatedQty,
                  },
                },
                data: {
                  packInStock: {
                    decrement: allocatedQty,
                  },
                },
              });

            if (changed.count !== 1) {
              throw new BillValidationError(
                `Stock changed while checking out '${selectedInventory.medicineBrand}'. Refresh POS and retry.`,
                409
              );
            }
          } else {
            const changed = await tx.$queryRaw<
              Array<{
                pack_in_stock: number;
                unit_in_stock: number;
              }>
            >`
              UPDATE inventory_tbl
                 SET pack_in_stock =
                       ((pack_in_stock * unit_per_pack + unit_in_stock - ${allocatedQty}) / unit_per_pack),
                     unit_in_stock =
                       MOD(pack_in_stock * unit_per_pack + unit_in_stock - ${allocatedQty}, unit_per_pack)
               WHERE id = ${batch.id}
                 AND (pack_in_stock * unit_per_pack + unit_in_stock) >= ${allocatedQty}
              RETURNING pack_in_stock, unit_in_stock
            `;

            if (!changed[0]) {
              throw new BillValidationError(
                `Stock changed while checking out '${selectedInventory.medicineBrand}'. Refresh POS and retry.`,
                409
              );
            }
          }

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

              medicineNameSnapshot:
                batch.medicineBrand,

              genericNameSnapshot:
                batch.generic?.name ||
                null,

              categoryNameSnapshot:
                batch.category?.name ||
                null,

              batchNumberSnapshot:
                batch.batchNumber,

              expiryDateSnapshot:
                batch.expiryDate,

              unitsPerPackSnapshot:
                batchUnitsPerPack,

              costPriceSnapshot:
                batch.costPrice,

              hasVatSnapshot:
                Boolean(batch.hasvat),

              rackLocationSnapshot:
                batch.rack?.name ||
                null,
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
          throw new BillValidationError(
            `FEFO allocation failed for '${selectedInventory.medicineBrand}'.`,
            409
          );
        }
      }
      // Return fully populated bill with relations.
      const persistedBill = await tx.bill.findUnique({
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

      return { bill: persistedBill, replayed: false };
    });

    res.status(billResult.replayed ? 200 : 201).json({
      success: true,
      message: billResult.replayed
        ? `Invoice ${billResult.bill?.invoiceNumber} was already committed; returning the existing sale without changing stock again.`
        : `Invoice ${billResult.bill?.invoiceNumber} generated and stock updated successfully.`,
      data: formatBillResponse(billResult.bill),
      replayed: billResult.replayed,
    });
  } catch (error) {
    console.error("Error creating bill:", error);

    const prismaCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";

    const statusCode =
      error instanceof BillValidationError
        ? error.statusCode
        : prismaCode === "P2002"
          ? 409
          : 500;

    res.status(statusCode).json({
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
    const [allBills, allReturns] = await Promise.all([
      prisma.bill.findMany({
        select: {
          id: true,
          grandTotal: true,
          vatAmount: true,
          subTotal: true,
          discountAmount: true,
          paymentMethod: true,
          transactionDate: true,
        },
      }),
      prisma.salesReturn.findMany({
        select: {
          refundAmount: true,
          returnDate: true,
          invoice: {
            select: {
              paymentMethod: true,
            },
          },
          items: {
            select: {
              refundAmount: true,
              billItem: {
                select: {
                  netItemPrice: true,
                  vatitemPrice: true,
                },
              },
            },
          },
        },
      }),
    ]);

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

    // Credit notes reduce revenue on the date the return is processed.
    // VAT is reversed proportionally from the immutable monetary values on
    // the original bill line rather than from today's inventory metadata.
    for (const salesReturn of allReturns) {
      const refund = Number(salesReturn.refundAmount || 0);
      totalRevenue -= refund;

      if (salesReturn.returnDate >= todayStart) {
        todayRevenue -= refund;
      }

      const method =
        (salesReturn.invoice.paymentMethod || "cash").toLowerCase();
      paymentBreakdown[method] =
        (paymentBreakdown[method] || 0) - refund;

      const returnedVat = salesReturn.items.reduce((sum, item) => {
        const lineNet = Number(item.billItem.netItemPrice || 0);
        const lineVat = Number(item.billItem.vatitemPrice || 0);
        const itemRefund = Number(item.refundAmount || 0);
        if (lineNet <= 0 || lineVat <= 0 || itemRefund <= 0) return sum;
        return sum + (itemRefund * lineVat / lineNet);
      }, 0);

      totalVat -= returnedVat;
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
    const numericId = Number(param);
    const { items: rawItems, returnedItems: rawReturnedItems, notes, reason } = req.body;
    const incomingList = rawReturnedItems || rawItems;

    if (!Array.isArray(incomingList) || incomingList.length === 0) {
      throw new BillValidationError(
        "At least one item to return must be specified."
      );
    }

    const normalizedItems = incomingList.map((item: any) => {
      const rawPacks = item.quantityInPack ?? item.quantityPacks ?? 0;
      const rawUnits = item.quantityInUnit ?? item.quantityLoose ?? 0;
      const returnPacks = Number(rawPacks);
      const returnUnits = Number(rawUnits);

      if (
        !Number.isInteger(returnPacks) ||
        !Number.isInteger(returnUnits) ||
        returnPacks < 0 ||
        returnUnits < 0
      ) {
        throw new BillValidationError(
          "Return quantities must be whole, non-negative numbers."
        );
      }

      return {
        billItemId: item.billItemId ? Number(item.billItemId) : null,
        inventoryId: item.inventoryId ? Number(item.inventoryId) : null,
        returnPacks,
        returnUnits,
      };
    });

    const billRef = await prisma.bill.findFirst({
      where: Number.isInteger(numericId) && numericId > 0
        ? { OR: [{ id: numericId }, { invoiceNumber: param }] }
        : { invoiceNumber: param },
      select: { id: true },
    });

    if (!billRef) {
      res.status(404).json({
        success: false,
        message: `Bill '${param}' not found.`,
      });
      return;
    }

    const user = (req as any).user;
    const recordedBy = user?.username
      ? `${user.firstName || user.username} (@${user.username})`
      : "Pharmacist";

    const returnResult = await prisma.$transaction(async (tx) => {
      // Serialize every return for the same original bill. This prevents two
      // terminals from both validating against the same refundable balance.
      await tx.$queryRaw`
        SELECT id
          FROM bill_tbl
         WHERE id = ${billRef.id}
         FOR UPDATE
      `;

      const bill = await tx.bill.findUnique({
        where: { id: billRef.id },
        include: {
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
          salesReturns: true,
        },
      });

      if (!bill) {
        throw new BillValidationError("Bill no longer exists.", 404);
      }

      let totalRefundAmount = 0;
      const seenBillItems = new Set<number>();
      const validatedItems: Array<{
        lineItem: any;
        returnPacks: number;
        returnUnits: number;
        lineRefund: number;
      }> = [];

      for (const ret of normalizedItems) {
        const lineItem = bill.items.find(
          (it) =>
            (ret.billItemId && it.id === ret.billItemId) ||
            (ret.inventoryId && it.inventoryId === ret.inventoryId)
        );

        if (!lineItem) {
          throw new BillValidationError(
            `Item with ID ${ret.billItemId || ret.inventoryId || "unknown"} not found on this invoice.`
          );
        }

        if (seenBillItems.has(lineItem.id)) {
          throw new BillValidationError(
            `Bill item ${lineItem.id} appears more than once in the same return request.`
          );
        }
        seenBillItems.add(lineItem.id);

        const { returnPacks, returnUnits } = ret;
        if (returnPacks === 0 && returnUnits === 0) continue;

        const soldPacks = Number(lineItem.quantityInPack || 0);
        const soldUnits = Number(lineItem.quantityInUnit || 0);
        const isLooseLine = soldUnits > 0 && soldPacks === 0;

        if (isLooseLine && returnPacks > 0) {
          throw new BillValidationError(
            "A loose-unit sale must be returned as loose units."
          );
        }
        if (!isLooseLine && returnUnits > 0) {
          throw new BillValidationError(
            "A pack sale must be returned as packs."
          );
        }

        const alreadyReturnedPacks = (lineItem.salesReturnItems || []).reduce(
          (sum: number, r: any) => sum + Number(r.quantityInPack || 0),
          0
        );
        const alreadyReturnedUnits = (lineItem.salesReturnItems || []).reduce(
          (sum: number, r: any) => sum + Number(r.quantityInUnit || 0),
          0
        );

        const returnablePacks = Math.max(0, soldPacks - alreadyReturnedPacks);
        const returnableUnits = Math.max(0, soldUnits - alreadyReturnedUnits);

        if (returnPacks > returnablePacks || returnUnits > returnableUnits) {
          throw new BillValidationError(
            `Return quantity (${returnPacks} pk, ${returnUnits} units) exceeds remaining returnable quantity (${returnablePacks} pk, ${returnableUnits} units) for ${lineItem.medicineNameSnapshot || lineItem.inventory?.medicineBrand || "item"}.`
          );
        }

        const soldQuantity = isLooseLine ? soldUnits : soldPacks;
        const returnedQuantity = isLooseLine ? returnUnits : returnPacks;
        const remainingQuantity = isLooseLine ? returnableUnits : returnablePacks;

        if (soldQuantity <= 0) {
          throw new BillValidationError(
            "Cannot calculate refund for a zero-quantity bill line."
          );
        }

        const netLineAmount = roundMoney(Number(lineItem.netItemPrice || 0));
        const alreadyRefunded = roundMoney(
          (lineItem.salesReturnItems || []).reduce(
            (sum: number, r: any) => sum + Number(r.refundAmount || 0),
            0
          )
        );
        const remainingRefund = roundMoney(
          Math.max(0, netLineAmount - alreadyRefunded)
        );

        let lineRefund =
          returnedQuantity === remainingQuantity
            ? remainingRefund
            : roundMoney(
                (netLineAmount * returnedQuantity) / soldQuantity
              );

        lineRefund = roundMoney(
          Math.min(remainingRefund, Math.max(0, lineRefund))
        );

        totalRefundAmount = roundMoney(totalRefundAmount + lineRefund);
        validatedItems.push({
          lineItem,
          returnPacks,
          returnUnits,
          lineRefund,
        });
      }

      if (validatedItems.length === 0) {
        throw new BillValidationError(
          "No items were specified with a return quantity greater than 0."
        );
      }

      // Fiscal year is derived from the return transaction date. Settings are
      // synchronized atomically with the credit-note counter so a stale
      // configured fiscal year cannot leak into a newly issued credit note.
      const currentCreditFiscalYear = getNepalFiscalYear();

      const issued = await tx.$queryRaw<
        Array<{
          fiscal_year: string;
          issued_number: number;
        }>
      >`
        UPDATE pharmacy_settings_tbl
           SET fiscal_year = ${currentCreditFiscalYear},
               invoice_prefix = CASE
                 WHEN invoice_prefix ~ '[0-9]{4}/[0-9]{2}'
                 THEN regexp_replace(
                   invoice_prefix,
                   '[0-9]{4}/[0-9]{2}',
                   ${currentCreditFiscalYear}
                 )
                 ELSE invoice_prefix
               END,
               next_credit_note_number = next_credit_note_number + 1
         WHERE id = (
           SELECT id
             FROM pharmacy_settings_tbl
            ORDER BY id ASC
            LIMIT 1
         )
        RETURNING fiscal_year,
                  next_credit_note_number - 1 AS issued_number
      `;

      if (!issued[0]) {
        throw new BillValidationError(
          "Pharmacy settings must be configured before issuing a credit note.",
          500
        );
      }

      const fiscalYear = String(issued[0].fiscal_year || "").trim();
      const creditNoteNumber =
        `CN-${fiscalYear}-${String(Number(issued[0].issued_number)).padStart(5, "0")}`;

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

        const unitsPerPack = Math.max(
          1,
          Number(
            lineItem.unitsPerPackSnapshot ??
            lineItem.inventory?.unitPerPack ??
            1
          )
        );
        const currentUnitsPerPack = Math.max(
          1,
          Number(lineItem.inventory?.unitPerPack ?? 1)
        );

        if (currentUnitsPerPack !== unitsPerPack) {
          throw new BillValidationError(
            `Cannot restock ${lineItem.medicineNameSnapshot || lineItem.inventory?.medicineBrand || `inventory row ${lineItem.inventoryId}`} because its units-per-pack changed after the sale. Resolve the inventory history before returning this item.`,
            409
          );
        }

        const returnedTotalUnits =
          returnPacks * unitsPerPack + returnUnits;

        const stockRows = await tx.$queryRaw<
          Array<{
            previous_packs: number;
            previous_loose: number;
            new_packs: number;
            new_loose: number;
          }>
        >`
          WITH before_row AS (
            SELECT id, pack_in_stock, unit_in_stock, unit_per_pack
              FROM inventory_tbl
             WHERE id = ${lineItem.inventoryId}
             FOR UPDATE
          ), updated AS (
            UPDATE inventory_tbl AS i
               SET pack_in_stock =
                     ((b.pack_in_stock * b.unit_per_pack + b.unit_in_stock + ${returnedTotalUnits}) / b.unit_per_pack),
                   unit_in_stock =
                     MOD(b.pack_in_stock * b.unit_per_pack + b.unit_in_stock + ${returnedTotalUnits}, b.unit_per_pack)
              FROM before_row AS b
             WHERE i.id = b.id
            RETURNING b.pack_in_stock AS previous_packs,
                      b.unit_in_stock AS previous_loose,
                      i.pack_in_stock AS new_packs,
                      i.unit_in_stock AS new_loose
          )
          SELECT * FROM updated
        `;

        const stock = stockRows[0];
        if (!stock) {
          throw new BillValidationError(
            `Inventory row ${lineItem.inventoryId} no longer exists; return was not committed.`,
            409
          );
        }

        await tx.stockAdjustmentLog.create({
          data: {
            medicineId: lineItem.inventoryId,
            adjustmentType: "CORRECTION",
            previousPacks: Number(stock.previous_packs),
            newPacks: Number(stock.new_packs),
            variancePacks: returnPacks,
            previousLooseUnits: Number(stock.previous_loose),
            newLooseUnits: Number(stock.new_loose),
            varianceLooseUnits: returnUnits,
            reason: `Customer Sales Return (Credit Note #${creditNoteNumber}, Inv #${bill.invoiceNumber}): ${notes || reason || "Medicine return"}`,
            recordedBy,
          },
        });

        returnedLineSummaries.push({
          billItemId: lineItem.id,
          inventoryId: lineItem.inventoryId,
          medicineName:
            lineItem.medicineNameSnapshot ||
            lineItem.inventory?.medicineBrand ||
            "Medicine",
          batchNumber:
            lineItem.batchNumberSnapshot ||
            lineItem.inventory?.batchNumber ||
            "N/A",
          quantityInPack: returnPacks,
          quantityInUnit: returnUnits,
          refundAmount: lineRefund,
        });
      }

      return {
        creditNoteNumber,
        totalRefundAmount: roundMoney(totalRefundAmount),
        items: returnedLineSummaries,
        invoiceNumber: bill.invoiceNumber,
        originalGrandTotal: Number(bill.grandTotal),
      };
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed customer return. Credit Note #${returnResult.creditNoteNumber}. Total Refund: NPR ${returnResult.totalRefundAmount}. Stock restocked.`,
      data: {
        creditNoteNumber: returnResult.creditNoteNumber,
        invoiceNumber: returnResult.invoiceNumber,
        originalGrandTotal: returnResult.originalGrandTotal,
        refundAmount: returnResult.totalRefundAmount,
        returnedItems: returnResult.items,
        notes: notes || reason || "Customer Sales Return",
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error processing sales return:", error);
    const statusCode =
      error instanceof BillValidationError
        ? error.statusCode
        : 400;
    res.status(statusCode).json({
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
              billItem: {
                select: {
                  medicineNameSnapshot: true,
                  batchNumberSnapshot: true,
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
              item.billItem
                .medicineNameSnapshot ||
              item.inventory
                .medicineBrand,

            batchNumber:
              item.billItem
                .batchNumberSnapshot ||
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
                item.billItem
                  .medicineNameSnapshot ||
                item.inventory
                  .medicineBrand,

              batchNumber:
                item.billItem
                  .batchNumberSnapshot ||
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
