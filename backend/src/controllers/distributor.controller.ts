import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatDistributorCode, parseIdParam } from "../utils/id.helpers.js";

type AnyRecord = Record<string, any>;

class DistributorValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DistributorValidationError";
    this.statusCode = statusCode;
  }
}

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const formatDistributorResponse = (distributor: any) => {
  return {
    id: formatDistributorCode(distributor.id),
    distributorId: distributor.id,
    name: distributor.name,
    panNumber: distributor.pannumber || "",
    pannumber: distributor.pannumber || "",
    phone: distributor.phone || "",
    email: distributor.email || "",
    address: distributor.address || "",
    contactPerson: distributor.contactPerson || "",
    creditLimit: Number(distributor.creditLimit || 0),
    currentBalance: Number(distributor.currentBalance || 0),
    notes: distributor.notes || "",
    status: distributor.status || "active",
    createdAt: distributor.createdAt ? new Date(distributor.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: distributor.updatedAt ? new Date(distributor.updatedAt).toISOString() : new Date().toISOString(),
  };
};

export const getAllDistributors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, limit, status } = req.query;

    const where: any = {};

    if (status && typeof status === "string") {
      where.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { pannumber: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        { address: { contains: term, mode: "insensitive" } },
        { contactPerson: { contains: term, mode: "insensitive" } },
      ];
    }

    const take = limit === "all" ? undefined : limit ? parseInt(limit as string, 10) : undefined;

    const distributors = await prisma.distributor.findMany({
      where,
      orderBy: { name: "asc" },
      take: take && !isNaN(take) ? take : undefined,
    });

    res.status(200).json({
      success: true,
      count: distributors.length,
      data: distributors.map(formatDistributorResponse),
    });
  } catch (error) {
    console.error("Error fetching distributors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve distributors.",
    });
  }
};

export const getDistributorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid distributor ID." });
      return;
    }

    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: {
        purchases: {
          take: 10,
          orderBy: { purchaseDate: "desc" },
        },
        ledgers: {
          take: 10,
          orderBy: { dateOfCreation: "desc" },
        },
      },
    });

    if (!distributor) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...formatDistributorResponse(distributor),
        recentPurchases: distributor.purchases,
        recentLedgers: distributor.ledgers,
      },
    });
  } catch (error) {
    console.error("Error fetching distributor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve distributor details.",
    });
  }
};

export const createDistributor = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      panNumber,
      pannumber,
      phone,
      email,
      address,
      contactPerson,
      creditLimit = 0,
      notes,
    } = req.body;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      res.status(400).json({ success: false, message: "Distributor name is required." });
      return;
    }

    const cleanPhone = String(phone || "").trim();
    if (!cleanPhone) {
      res.status(400).json({ success: false, message: "Distributor phone number is required." });
      return;
    }
    if (!/^\d{7,10}$/.test(cleanPhone)) {
      res.status(400).json({ success: false, message: "Distributor phone number must contain between 7 and 10 digits." });
      return;
    }

    const cleanPan = (panNumber || pannumber) ? String(panNumber || pannumber).trim() : null;
    if (cleanPan && !/^\d{9}$/.test(cleanPan)) {
      res.status(400).json({ success: false, message: "Distributor PAN must contain exactly 9 digits." });
      return;
    }
    const cleanEmail = email ? String(email).trim() : "";
    if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      res.status(400).json({ success: false, message: "Please provide a valid distributor email address." });
      return;
    }

    const parsedCreditLimit = Number(creditLimit);
    if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0) {
      res.status(400).json({
        success: false,
        message: "Credit limit must be zero or a positive number.",
      });
      return;
    }

    // Optional uniqueness warning for name
    const existing = await prisma.distributor.findFirst({
      where: { name: { equals: cleanName, mode: "insensitive" } },
    });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Distributor "${cleanName}" already exists.`,
      });
      return;
    }

    const distributor = await prisma.distributor.create({
      data: {
        name: cleanName,
        phone: cleanPhone,
        pannumber: cleanPan,
        email: cleanEmail || null,
        address: address ? String(address).trim() : null,
        contactPerson: contactPerson ? String(contactPerson).trim() : null,
        creditLimit: parsedCreditLimit,
        currentBalance: 0,
        notes: notes ? String(notes).trim() : null,
        status: "active",
      },
    });

    res.status(201).json({
      success: true,
      message: `Distributor "${cleanName}" created successfully.`,
      data: formatDistributorResponse(distributor),
    });
  } catch (error) {
    console.error("Error creating distributor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create distributor.",
    });
  }
};

export const updateDistributor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid distributor ID." });
      return;
    }

    const existing = await prisma.distributor.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    const {
      name,
      panNumber,
      pannumber,
      phone,
      email,
      address,
      contactPerson,
      creditLimit,
      notes,
      status,
    } = req.body;

    const data: any = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        res.status(400).json({ success: false, message: "Distributor name cannot be empty." });
        return;
      }
      const duplicateName = await prisma.distributor.findFirst({
        where: {
          id: { not: id },
          name: { equals: cleanName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicateName) {
        res.status(409).json({ success: false, message: `Distributor "${cleanName}" already exists.` });
        return;
      }
      data.name = cleanName;
    }
    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (!/^\d{7,10}$/.test(cleanPhone)) {
        res.status(400).json({ success: false, message: "Distributor phone number must contain between 7 and 10 digits." });
        return;
      }
      data.phone = cleanPhone;
    }
    if (panNumber !== undefined || pannumber !== undefined) {
      const cleanPan = String(panNumber ?? pannumber ?? "").trim();
      if (cleanPan && !/^\d{9}$/.test(cleanPan)) {
        res.status(400).json({ success: false, message: "Distributor PAN must contain exactly 9 digits." });
        return;
      }
      data.pannumber = cleanPan || null;
    }
    if (email !== undefined) {
      const cleanEmail = String(email).trim();
      if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
        res.status(400).json({ success: false, message: "Please provide a valid distributor email address." });
        return;
      }
      data.email = cleanEmail || null;
    }
    if (address !== undefined) data.address = String(address).trim() || null;
    if (contactPerson !== undefined) data.contactPerson = String(contactPerson).trim() || null;
    if (creditLimit !== undefined) {
      const parsedCreditLimit = Number(creditLimit);
      if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0) {
        res.status(400).json({
          success: false,
          message: "Credit limit must be zero or a positive number.",
        });
        return;
      }
      data.creditLimit = parsedCreditLimit;
    }
    if (notes !== undefined) data.notes = String(notes).trim() || null;
    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (!["active", "inactive"].includes(normalizedStatus)) {
        res.status(400).json({ success: false, message: "Distributor status must be 'active' or 'inactive'." });
        return;
      }
      data.status = normalizedStatus;
    }

    const updated = await prisma.distributor.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      message: `Distributor "${updated.name}" updated successfully.`,
      data: formatDistributorResponse(updated),
    });
  } catch (error) {
    console.error("Error updating distributor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update distributor.",
    });
  }
};

export const deleteDistributor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid distributor ID." });
      return;
    }

    const existing = await prisma.distributor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventories: true,
            purchases: true,
            ledgers: true,
            returns: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    // Never destroy supplier-account history. Any linked stock, invoice,
    // ledger or debit-note history makes this a deactivation, not a hard delete.
    if (
      existing._count.inventories > 0 ||
      existing._count.purchases > 0 ||
      existing._count.ledgers > 0 ||
      existing._count.returns > 0
    ) {
      await prisma.distributor.update({
        where: { id },
        data: { status: "inactive" },
      });

      res.status(200).json({
        success: true,
        message: `Distributor "${existing.name}" has linked stock/accounting history and was marked inactive instead of deleted.`,
      });
      return;
    }

    await prisma.distributor.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: `Distributor "${existing.name}" removed successfully.`,
    });
  } catch (error) {
    console.error("Error deleting distributor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete distributor.",
    });
  }
};

export const getDistributorLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid distributor ID." });
      return;
    }

    const distributor = await prisma.distributor.findUnique({ where: { id } });
    if (!distributor) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    const ledgers = await prisma.ledger.findMany({
      where: { distributorId: id },
      orderBy: [
        { dateOfCreation: "desc" },
        { id: "desc" },
      ],
    });

    const formattedLedger = ledgers.map((l) => ({
      id: String(l.id),
      ledgerId: l.id,
      stockistId: formatDistributorCode(distributor.id),
      distributorId: distributor.id,
      date: l.dateOfCreation.toISOString().split("T")[0],
      refType:
        l.ledgerType === "purchase"
          ? "purchase_invoice"
          : l.ledgerType === "payment"
          ? "payment_made"
          : l.ledgerType === "return"
          ? "return_debit_note"
          : l.ledgerType,
      refNumber: l.referenceNo || `REF-${l.id}`,
      description: l.description || "",
      debit: Number(l.debitAmount),
      credit: Number(l.creditAmount),
      balance: Number(l.balance),
      createdAt: l.dateOfCreation.toISOString(),
    }));

    res.status(200).json({
      success: true,
      distributor: formatDistributorResponse(distributor),
      count: formattedLedger.length,
      data: formattedLedger,
    });
  } catch (error) {
    console.error("Error fetching distributor ledger:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve distributor ledger.",
    });
  }
};

export const recordDistributorPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid distributor ID." });
      return;
    }

    const { amount, paymentMode = "Bank Transfer", refNumber, notes } = req.body;

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, message: "Payment amount must be greater than zero." });
      return;
    }

    const distributor = await prisma.distributor.findUnique({ where: { id } });
    if (!distributor) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    const cleanRef = String(refNumber || `PAY-${Date.now().toString().slice(-6)}`).trim();
    const cleanMode = String(paymentMode || "Bank Transfer").trim();
    const description = `Payment made via ${cleanMode.toUpperCase()}${notes ? ` (${notes})` : ""}`;
    const authUser = (req as any).user ?? {};
    const recordedBy = String(authUser.username ?? authUser.id ?? "unknown");

    const result = await prisma.$transaction(async (tx) => {
      // Serialize every posting for this supplier so ledger running-balance
      // snapshots stay deterministic under concurrent requests.
      const accountLockKey = `supplier-account:${id}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${accountLockKey}))
      `;

      const updatedDistributor = await tx.distributor.update({
        where: { id },
        data: {
          currentBalance: { decrement: parsedAmount },
        },
      });
      const newBal = Number(updatedDistributor.currentBalance || 0);

      // 2. Create Ledger entry (Debit reduces liability)
      const ledgerEntry = await tx.ledger.create({
        data: {
          distributorId: id,
          ledgerType: "payment",
          referenceNo: cleanRef,
          description,
          recordedBy,
          debitAmount: parsedAmount,
          creditAmount: 0,
          balance: newBal,
        },
      });

      return { updatedDistributor, ledgerEntry };
    });

    res.status(200).json({
      success: true,
      message: `Payment of Rs. ${parsedAmount.toFixed(2)} recorded successfully.`,
      data: {
        distributor: formatDistributorResponse(result.updatedDistributor),
        ledgerEntry: {
          id: String(result.ledgerEntry.id),
          stockistId: formatDistributorCode(id),
          date: result.ledgerEntry.dateOfCreation.toISOString().split("T")[0],
          refType: "payment_made",
          refNumber: cleanRef,
          description,
          debit: parsedAmount,
          credit: 0,
          balance: Number(result.updatedDistributor.currentBalance || 0),
        },
      },
    });
  } catch (error) {
    console.error("Error recording distributor payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record distributor payment.",
    });
  }
};

export const getDistributorReturns = async (_req: Request, res: Response): Promise<void> => {
  try {
    const returns = await prisma.distributorReturn.findMany({
      include: { distributor: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });

    res.status(200).json({
      success: true,
      data: returns.map((entry) => ({
        id: `ret-${entry.id}`,
        debitNoteNumber: entry.debitNoteNumber,
        stockistId: formatDistributorCode(entry.distributorId),
        stockistName: entry.distributor.name,
        date: entry.date.toISOString().split("T")[0],
        items: Array.isArray(entry.items) ? entry.items : [],
        totalAmount: Number(entry.totalAmount),
        notes: entry.notes || "",
        recordedBy: entry.recordedBy || null,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching distributor returns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch distributor returns.",
    });
  }
};

export const recordDistributorReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) {
      throw new DistributorValidationError("Invalid distributor ID.");
    }

    const { debitNoteNumber, items, date, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new DistributorValidationError(
        "At least one medicine item is required for a supplier return."
      );
    }

    const cleanDebitNote = String(debitNoteNumber || "").trim();
    if (!cleanDebitNote) {
      throw new DistributorValidationError("Debit note number is required.");
    }

    let cleanDate = new Date();
    if (date !== undefined && date !== null && String(date).trim() !== "") {
      const rawDate = String(date).trim();
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? new Date(`${rawDate}T12:00:00`)
        : new Date(rawDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new DistributorValidationError("Return date is invalid.");
      }
      cleanDate = parsed;
    }

    const authUser = (req as any).user ?? {};
    const recordedBy = String(
      authUser.username ?? authUser.fullName ?? "Pharmacist"
    );

    const result = await prisma.$transaction(async (tx) => {
      // Use the same account lock as payments, purchases and cancellations.
      const accountLockKey = `supplier-account:${id}`;
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${accountLockKey}))
      `;

      const distributor = await tx.distributor.findUnique({ where: { id } });
      if (!distributor) {
        throw new DistributorValidationError("Distributor not found.", 404);
      }

      const duplicate = await tx.distributorReturn.findUnique({
        where: { debitNoteNumber: cleanDebitNote },
        select: { id: true },
      });
      if (duplicate) {
        throw new DistributorValidationError(
          `Debit Note #${cleanDebitNote} already exists.`,
          409
        );
      }

      const seenInventoryIds = new Set<number>();
      const processedItems: AnyRecord[] = [];
      let authoritativeTotal = 0;

      for (const [index, item] of items.entries()) {
        const rawMedicineId = item?.medicineId ?? item?.id;
        const medId = parseIdParam(rawMedicineId);

        let med = medId
          ? await tx.inventory.findUnique({ where: { id: medId } })
          : null;

        if (!med && item?.medicineName && item?.batchNumber) {
          med = await tx.inventory.findFirst({
            where: {
              medicineBrand: {
                equals: String(item.medicineName).trim(),
                mode: "insensitive",
              },
              batchNumber: {
                equals: String(item.batchNumber).trim(),
                mode: "insensitive",
              },
            },
          });
        }

        if (!med) {
          throw new DistributorValidationError(
            `Return row ${index + 1}: medicine was not found.`,
            404
          );
        }

        if (med.distributorId !== id) {
          throw new DistributorValidationError(
            `Medicine '${med.medicineBrand}' does not belong to the selected distributor.`,
            409
          );
        }

        if (seenInventoryIds.has(med.id)) {
          throw new DistributorValidationError(
            `Medicine '${med.medicineBrand}' appears more than once in this return. Combine it into one row.`
          );
        }
        seenInventoryIds.add(med.id);

        const packsToDeduct = Number(item?.packs ?? 0);
        const looseToDeduct = Number(item?.looseUnits ?? 0);

        if (
          !Number.isInteger(packsToDeduct) ||
          packsToDeduct < 0 ||
          !Number.isInteger(looseToDeduct) ||
          looseToDeduct < 0
        ) {
          throw new DistributorValidationError(
            `Return quantities for '${med.medicineBrand}' must be non-negative whole numbers.`
          );
        }

        const unitsPerPack = Math.max(1, med.unitPerPack || 1);
        if (looseToDeduct >= unitsPerPack) {
          throw new DistributorValidationError(
            `Loose return quantity for '${med.medicineBrand}' must be less than ${unitsPerPack}. Convert full units into packs.`
          );
        }

        const deductTotalUnits =
          packsToDeduct * unitsPerPack + looseToDeduct;
        if (deductTotalUnits <= 0) {
          throw new DistributorValidationError(
            `Return quantity for '${med.medicineBrand}' must be greater than zero.`
          );
        }

        // Lock the exact stock row before reading its quantities. This makes
        // simultaneous supplier returns deterministic and prevents oversell/
        // over-return from stale read-modify-write state.
        const lockedRows = await tx.$queryRaw<Array<{
          id: number;
          pack_in_stock: number;
          unit_in_stock: number;
        }>>`
          SELECT id, pack_in_stock, unit_in_stock
          FROM inventory_tbl
          WHERE id = ${med.id}
          FOR UPDATE
        `;

        const locked = lockedRows[0];
        if (!locked) {
          throw new DistributorValidationError(
            `Medicine '${med.medicineBrand}' no longer exists.`,
            409
          );
        }

        const previousPacks = Number(locked.pack_in_stock);
        const previousLoose = Number(locked.unit_in_stock);
        const currentTotalUnits =
          previousPacks * unitsPerPack + previousLoose;

        if (deductTotalUnits > currentTotalUnits) {
          throw new DistributorValidationError(
            `Return quantity exceeds available stock for '${med.medicineBrand}'.`,
            409
          );
        }

        const remainingUnits = currentTotalUnits - deductTotalUnits;
        const newPacks = Math.floor(remainingUnits / unitsPerPack);
        const newLoose = remainingUnits % unitsPerPack;

        await tx.inventory.update({
          where: { id: med.id },
          data: { packInStock: newPacks, unitInStock: newLoose },
        });

        await tx.stockAdjustmentLog.create({
          data: {
            medicineId: med.id,
            adjustmentType: "DISPOSAL",
            previousPacks,
            newPacks,
            variancePacks: newPacks - previousPacks,
            previousLooseUnits: previousLoose,
            newLooseUnits: newLoose,
            varianceLooseUnits: newLoose - previousLoose,
            reason: item?.reason
              ? `Wholesaler Return (${cleanDebitNote}): ${String(item.reason).trim()}`
              : `Wholesaler Return (${cleanDebitNote})`,
            recordedBy,
          },
        });

        const costPerPack = Number(med.costPrice);
        if (!Number.isFinite(costPerPack) || costPerPack < 0) {
          throw new DistributorValidationError(
            `Medicine '${med.medicineBrand}' has an invalid stored cost price.`,
            409
          );
        }

        const lineAmount = roundMoney(
          packsToDeduct * costPerPack +
            looseToDeduct * (costPerPack / unitsPerPack)
        );
        authoritativeTotal = roundMoney(authoritativeTotal + lineAmount);

        processedItems.push({
          medicineId: med.id,
          medicineName: med.medicineBrand,
          batchNumber: med.batchNumber,
          packs: packsToDeduct,
          looseUnits: looseToDeduct,
          unitsPerPack,
          costPrice: costPerPack,
          lineAmount,
          reason: item?.reason ? String(item.reason).trim() : "",
        });
      }

      if (authoritativeTotal <= 0) {
        throw new DistributorValidationError(
          "Return total calculated from inventory cost prices must be greater than zero."
        );
      }

      const updatedDistributor = await tx.distributor.update({
        where: { id },
        data: { currentBalance: { decrement: authoritativeTotal } },
      });
      const newBalance = Number(updatedDistributor.currentBalance || 0);

      const description =
        `Debit Note #${cleanDebitNote}: Return of Damaged/Expired medicines ` +
        `(${processedItems.length} items)${notes ? ` - ${String(notes).trim()}` : ""}`;

      const ledgerEntry = await tx.ledger.create({
        data: {
          distributorId: id,
          ledgerType: "return",
          referenceNo: cleanDebitNote,
          description,
          recordedBy,
          debitAmount: authoritativeTotal,
          creditAmount: 0,
          balance: newBalance,
          dateOfCreation: cleanDate,
        },
      });

      const returnVoucher = await tx.distributorReturn.create({
        data: {
          distributorId: id,
          debitNoteNumber: cleanDebitNote,
          date: cleanDate,
          items: processedItems,
          totalAmount: authoritativeTotal,
          notes: notes ? String(notes).trim() : null,
          recordedBy,
        },
      });

      return {
        distributor,
        updatedDistributor,
        ledgerEntry,
        returnVoucher,
        authoritativeTotal,
        newBalance,
      };
    });

    res.status(200).json({
      success: true,
      message:
        `Debit Note #${cleanDebitNote} recorded successfully. ` +
        `Supplier balance reduced by Rs. ${result.authoritativeTotal.toFixed(2)}.`,
      data: {
        distributor: formatDistributorResponse(result.updatedDistributor),
        ledgerEntry: {
          id: String(result.ledgerEntry.id),
          stockistId: formatDistributorCode(id),
          date: result.ledgerEntry.dateOfCreation.toISOString().split("T")[0],
          refType: "return_debit_note",
          refNumber: cleanDebitNote,
          description: result.ledgerEntry.description,
          debit: result.authoritativeTotal,
          credit: 0,
          balance: result.newBalance,
        },
        returnVoucher: {
          id: `ret-${result.returnVoucher.id}`,
          debitNoteNumber: result.returnVoucher.debitNoteNumber,
          stockistId: formatDistributorCode(id),
          stockistName: result.distributor.name,
          date: result.returnVoucher.date.toISOString().split("T")[0],
          items: Array.isArray(result.returnVoucher.items)
            ? result.returnVoucher.items
            : [],
          totalAmount: Number(result.returnVoucher.totalAmount),
          notes: result.returnVoucher.notes || "",
          recordedBy: result.returnVoucher.recordedBy || null,
          createdAt: result.returnVoucher.createdAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error("Error recording distributor return:", error);

    if (error instanceof DistributorValidationError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }

    if (error?.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "A supplier return with this debit note number already exists.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to record distributor return.",
    });
  }
};
