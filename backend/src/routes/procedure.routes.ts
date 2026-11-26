import { Router, type Response } from "express";
import { prisma } from "../db.js";
import {
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { parseNepalDateBoundary } from "../utils/nepal-time.js";

const router = Router();
const methods = new Set(["cash", "fonepay_qr", "card"]);

const cleanText = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const positiveId = (value: unknown): number | null => {
  const result = Number(value);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
};

const decimalCents = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
};

const money = (cents: number): string => (cents / 100).toFixed(2);
const formatInvoice = (invoice: any) => ({
  id: invoice.id,
  invoiceNumber: `PRC-${String(invoice.id).padStart(6, "0")}`,
  clientRequestId: invoice.clientRequestId,
  patientId: invoice.patientId,
  clinicNumber: invoice.patientId
    ? `CL-${String(invoice.patientId).padStart(6, "0")}` : null,
  patientName: invoice.patientName,
  patientPhone: invoice.patientPhone,
  // Never populate from phone-only matches; this is a persisted, verified link.
  customerId: invoice.customerId ?? null,
  membershipNumber: invoice.customer?.membershipNumber ?? null,
  paymentMethod: invoice.paymentMethod,
  totalAmount: Number(invoice.totalAmount),
  notes: invoice.notes,
  createdAt: invoice.createdAt,
  createdBy: invoice.createdBy ? {
    username: invoice.createdBy.username,
    name: `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`.trim(),
  } : null,
  items: invoice.items.map((item: any) => ({
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    quantity: item.quantity,
    unitFee: Number(item.unitFee),
    lineTotal: Number(item.lineTotal),
  })),
});

const invoiceInclude = {
  items: { orderBy: { id: "asc" as const } },
  createdBy: { select: { username: true, firstName: true, lastName: true } },
  customer: { select: { membershipNumber: true } },
};

function dateFilter(req: AuthenticatedRequest, res: Response):
  { createdAt?: { gte?: Date; lte?: Date } } | null {
  const from = cleanText(req.query.from, 100);
  const to = cleanText(req.query.to, 100);
  const fromDate = from ? parseNepalDateBoundary(from, false) : null;
  const toDate = to ? parseNepalDateBoundary(to, true) : null;
  if ((from && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !fromDate)) ||
      (to && (!/^\d{4}-\d{2}-\d{2}$/.test(to) || !toDate)) ||
      (fromDate && toDate && fromDate.getTime() > toDate.getTime())) {
    res.status(400).json({ success: false, message: "Invalid procedure report date range." });
    return null;
  }
  return (fromDate || toDate) ? {
    createdAt: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    },
  } : {};
}

// Report must precede the /:id route, and is admin-only.
router.get("/report", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const where = dateFilter(req, res);
  if (!where) return;
  try {
    const summary = await prisma.procedureInvoice.groupBy({
      by: ["paymentMethod"], where,
      _sum: { totalAmount: true }, _count: { _all: true },
    });
    res.json({ success: true, data: {
      invoiceCount: summary.reduce((sum, row) => sum + row._count._all, 0),
      paidTotal: summary.reduce((sum, row) => sum + Number(row._sum.totalAmount || 0), 0),
      paymentMethods: summary.map(row => ({
        method: row.paymentMethod, count: row._count._all,
        amount: Number(row._sum.totalAmount || 0),
      })),
      note: "Procedure payments are tracked separately from OPD charges and POS sales.",
    }});
  } catch (error) {
    console.error("Procedure report failed", error);
    res.status(500).json({ success: false, message: "Unable to load procedure summary." });
  }
});

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const dateWhere = dateFilter(req, res);
  if (!dateWhere) return;
  const search = cleanText(req.query.search, 100); // Legacy combined search compatibility.
  const patientName = cleanText(req.query.patientName, 120);
  const rawPhone = req.query.patientPhone;
  const patientPhone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const receipt = cleanText(req.query.receipt, 32).toUpperCase();
  if ((rawPhone !== undefined &&
       (typeof rawPhone !== "string" || !/^\d{0,10}$/.test(patientPhone))) ||
      (receipt && !/^PRC-\d+$/.test(receipt))) {
    res.status(400).json({ success: false, message: "Use up to 10 phone digits and a receipt like PRC-000001." });
    return;
  }
  const receiptId = receipt ? positiveId(receipt.slice(4)) : null;
  if (receipt && !receiptId) {
    res.status(400).json({ success: false, message: "Invalid procedure receipt number." });
    return;
  }
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const pageSize = 20;
  const invoiceId = /^PRC-\d+$/i.test(search) ? positiveId(search.slice(4)) : null;
  const where = {
    ...dateWhere,
    ...(patientName ? { patientName: { contains: patientName, mode: "insensitive" as const } } : {}),
    ...(patientPhone ? { patientPhone: { contains: patientPhone } } : {}),
    ...(receiptId ? { id: receiptId } : {}),
    ...(search ? { OR: [
      { patientName: { contains: search, mode: "insensitive" as const } },
      { patientPhone: { contains: search } },
      ...(invoiceId ? [{ id: invoiceId }] : []),
    ] } : {}),
  };
  try {
    const [data, total] = await Promise.all([
      prisma.procedureInvoice.findMany({
        where, include: invoiceInclude,
        orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.procedureInvoice.count({ where }),
    ]);
    res.json({ success: true, data: data.map(formatInvoice), pagination: {
      total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }});
  } catch (error) {
    console.error("Procedure history failed", error);
    res.status(500).json({ success: false, message: "Unable to load procedure history." });
  }
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const id = positiveId(String(req.params.id || "").replace(/^PRC-/i, ""));
  if (!id) { res.status(400).json({ success: false, message: "Invalid receipt number." }); return; }
  try {
    const invoice = await prisma.procedureInvoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) { res.status(404).json({ success: false, message: "Procedure bill not found." }); return; }
    res.json({ success: true, data: formatInvoice(invoice) });
  } catch (error) {
    console.error("Procedure detail failed", error);
    res.status(500).json({ success: false, message: "Unable to load procedure bill." });
  }
});

// Paid-only bill, separate from POS credit and doctor consultations.
router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) { res.status(401).json({ success: false, message: "Authentication required." }); return; }
  const clientRequestId = cleanText(req.body?.clientRequestId, 90);
  const patientId = req.body?.patientId == null ? null : positiveId(req.body.patientId);
  const customerId = req.body?.customerId == null ? null : positiveId(req.body.customerId);
  const patientName = cleanText(req.body?.patientName, 120);
  const rawPhone = cleanText(req.body?.patientPhone, 40);
  const phone = rawPhone.replace(/\D/g, "");
  const notes = cleanText(req.body?.notes, 300);
  const paymentMethod = cleanText(req.body?.paymentMethod, 30);
  const rawItems: unknown = req.body?.items;
  if (!/^[a-zA-Z0-9-]{12,90}$/.test(clientRequestId) ||
      (req.body?.patientId != null && !patientId) ||
      (req.body?.customerId != null && !customerId) ||
      (!patientId && patientName.length < 2) ||
      (rawPhone && !/^\d{10}$/.test(phone)) ||
      !methods.has(paymentMethod) ||
      !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) {
    res.status(400).json({ success: false, message: "Check patient, procedure items and payment information." });
    return;
  }
  // Each billed item is written by staff for this specific visit; no fixed catalog.
  const requested = rawItems.map((entry: any) => ({
    name: typeof entry?.name === "string" ? entry.name.trim() : "",
    chargeCents: decimalCents(entry?.unitFee),
    quantity: entry?.quantity,
  }));
  if (requested.some(item => item.name.length < 2 || item.name.length > 100 ||
      /[\x00-\x1f\x7f]/.test(item.name) ||
      item.chargeCents === null || item.chargeCents <= 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    res.status(400).json({ success: false, message: "Enter a procedure description and a positive charge (up to two decimals) for every item." });
    return;
  }
  const totalCents = requested.reduce((sum, item) => sum + (item.chargeCents as number) * item.quantity, 0);
  if (totalCents <= 0 || totalCents > 999999999) {
    res.status(400).json({ success: false, message: "Procedure total is outside the permitted range." });
    return;
  }
  try {
    const existing = await prisma.procedureInvoice.findUnique({
      where: { clientRequestId }, include: invoiceInclude,
    });
    if (existing) {
      res.status(existing.createdById === req.user.id ? 200 : 409).json(
        existing.createdById === req.user.id
          ? { success: true, data: formatInvoice(existing), duplicate: true }
          : { success: false, message: "Request identifier already used." }
      );
      return;
    }
    const saved = await prisma.$transaction(async (tx) => {
      let resolvedName = patientName;
      let resolvedPhone = phone || null;
      if (patientId) {
        const patient = await tx.clinicPatient.findUnique({
          where: { id: patientId }, select: { name: true, phone: true },
        });
        if (!patient) throw new Error("PATIENT_NOT_FOUND");
        resolvedName = patient.name;
        resolvedPhone = patient.phone;
      }
      // The selected member must still exist AND match the person on the bill.
      // Explicit selection, member id, name and phone must all agree.
      if (customerId) {
        const member = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true, membershipNumber: true, memberSince: true, voidedAt: true },
        });
        const sameName = (a: string, b: string) =>
          a.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
          b.trim().replace(/\s+/g, " ").toLocaleLowerCase();
        if (!member?.membershipNumber || !member.memberSince || member.voidedAt ||
            !sameName(member.name, resolvedName) || member.phone !== resolvedPhone) {
          throw new Error("MEMBER_MISMATCH");
        }
      }
      const items = requested.map(item => {
        const cents = item.chargeCents as number;
        return {
          serviceName: item.name,
          quantity: item.quantity,
          unitFee: money(cents),
          lineTotal: money(cents * item.quantity),
          // serviceId intentionally omitted (nullable after new migration).
        };
      });
      return tx.procedureInvoice.create({
        data: {
          clientRequestId,
          patientId,
          customerId,
          patientName: resolvedName,
          patientPhone: resolvedPhone,
          paymentMethod,
          totalAmount: money(totalCents),
          notes: notes || null,
          createdById: req.user!.id,
          items: { create: items },
        },
        include: invoiceInclude,
      });
    });
    res.status(201).json({ success: true, data: formatInvoice(saved) });
  } catch (error: any) {
    if (error?.message === "MEMBER_MISMATCH") {
      res.status(409).json({ success: false, message: "Selected membership no longer matches this patient. Review the name and phone, then select the member again." }); return;
    }
    if (error?.message === "PATIENT_NOT_FOUND") {
      res.status(400).json({ success: false, message: "Patient no longer exists; search again." }); return;
    }
    if (error?.code === "P2002") {
      const existing = await prisma.procedureInvoice.findUnique({
        where: { clientRequestId }, include: invoiceInclude,
      }).catch(() => null);
      if (existing && existing.createdById === req.user.id) {
        res.json({ success: true, duplicate: true, data: formatInvoice(existing) });
        return;
      }
      res.status(409).json({ success: false, message: "Procedure request was already recorded." });
      return;
    }
    console.error("Procedure billing failed", error);
    res.status(500).json({ success: false, message: "Unable to create procedure bill. Check history before retrying." });
  }
});

export default router;
