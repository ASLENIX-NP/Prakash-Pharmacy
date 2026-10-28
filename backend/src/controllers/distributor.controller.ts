import { Request, Response } from "express";
import { prisma } from "../db.js";
import { formatDistributorCode, parseIdParam } from "../utils/id.helpers.js";

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
        creditLimit: parseFloat(String(creditLimit)) || 0,
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
    if (name !== undefined) data.name = String(name).trim();
    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (cleanPhone && !/^\d{7,10}$/.test(cleanPhone)) {
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
    if (creditLimit !== undefined) data.creditLimit = parseFloat(String(creditLimit)) || 0;
    if (notes !== undefined) data.notes = String(notes).trim() || null;
    if (status !== undefined) data.status = String(status).trim();

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
          select: { inventories: true, purchases: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Distributor not found." });
      return;
    }

    // Safety guard: If distributor is tied to medicines or purchase invoices, do not hard-delete
    if (existing._count.inventories > 0 || existing._count.purchases > 0) {
      await prisma.distributor.update({
        where: { id },
        data: { status: "inactive" },
      });

      res.status(200).json({
        success: true,
        message: `Distributor "${existing.name}" is linked to existing stock or invoices and was marked inactive.`,
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
      orderBy: { dateOfCreation: "desc" },
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

    const currentBal = Number(distributor.currentBalance || 0);
    const newBal = currentBal - parsedAmount;
    const cleanRef = String(refNumber || `PAY-${Date.now().toString().slice(-6)}`).trim();
    const cleanMode = String(paymentMode || "Bank Transfer").trim();
    const description = `Payment made via ${cleanMode.toUpperCase()}${notes ? ` (${notes})` : ""}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update distributor balance
      const updatedDistributor = await tx.distributor.update({
        where: { id },
        data: { currentBalance: newBal },
      });

      // 2. Create Ledger entry (Debit reduces liability)
      const ledgerEntry = await tx.ledger.create({
        data: {
          distributorId: id,
          ledgerType: "payment",
          referenceNo: cleanRef,
          description,
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
          balance: newBal,
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
