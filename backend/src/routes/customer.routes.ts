import { Router, Request, Response } from "express";
import { prisma } from "../db.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

// MEMBERSHIP REGISTRATION: 127D
// Only explicit admin registration grants membership. POS/OPD must not enroll customers.
// Existing customer profiles require a separate, deliberate confirmation; never merge by phone alone.
const normalizeMemberName = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const memberNameKey = (value: string): string =>
  normalizeMemberName(value).toLowerCase();

class MembershipRegistrationConflict extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly existingCustomer?: {
      id: number;
      name: string;
      phone: string;
      address: string | null;
    }
  ) {
    super(message);
  }
}

router.post(
  "/members",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (
      typeof body.name !== "string" ||
      typeof body.phone !== "string" ||
      typeof body.address !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Name, phone number and address are required.",
      });
      return;
    }

    const name = normalizeMemberName(body.name);
    const address = body.address.trim().replace(/\s+/g, " ");
    const rawPhone = body.phone.trim();
    const phone = rawPhone.replace(/\D/g, "");
    const confirmExistingProfile = body.confirmExistingProfile === true;

    if (
      name.length < 2 || name.length > 150 ||
      /^(counter customer|counter patient)$/i.test(name) ||
      address.length < 3 || address.length > 300 ||
      !/^\d{7,10}$/.test(phone)
    ) {
      if (!/^\d{7,10}$/.test(phone)) {
        res.status(400).json({
          success: false,
          message: "Phone number must be between 7 and 10 digits (numbers only).",
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: "Enter a valid name (2-150 characters), phone (7-10 digits), and address (3-300 characters).",
      });
      return;
    }

    try {
      const member = await prisma.$transaction(async (tx) => {
        const existing = await tx.customer.findUnique({
          where: { phone },
          select: {
            id: true, name: true, phone: true, address: true,
            membershipNumber: true, memberSince: true, voidedAt: true,
          },
        });

        if (existing?.voidedAt) {
          throw new MembershipRegistrationConflict(
            "VOIDED_MEMBER_EXISTS",
            "This phone number belongs to a voided member. Restore them from Voided Members instead of registering again."
          );
        }

        if (existing?.membershipNumber || existing?.memberSince) {
          throw new MembershipRegistrationConflict(
            "ALREADY_MEMBER",
            "This phone number already has a registered membership."
          );
        }

        // Look for historical phone use WITHOUT linking any histories.
        // This prevents registering a new profile whose phone may belong to
        // an older, unlinked customer or a conflicting group of people.
        const history = await tx.$queryRaw<Array<{ source: string; recorded_name: string | null }>>`
          SELECT 'pos' AS source, customer_name AS recorded_name
          FROM bill_tbl
          WHERE regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g') = ${phone}
          UNION ALL
          SELECT 'opd' AS source, name AS recorded_name
          FROM clinic_patients_tbl
          WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${phone}
        `;

        const otherNames = history
          .map((record) => typeof record.recorded_name === "string"
            ? memberNameKey(record.recorded_name) : "")
          .filter((recorded) => recorded &&
            recorded !== "counter customer" &&
            recorded !== "counter patient" &&
            recorded !== memberNameKey(name));

        if (!existing && history.length > 0) {
          throw new MembershipRegistrationConflict(
            "HISTORY_REVIEW_REQUIRED",
            "Historical POS or OPD records use this phone. Review identity before registering a membership."
          );
        }

        if (existing) {
          const currentProfile = {
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            address: existing.address,
          };
          if (
            memberNameKey(existing.name) !== memberNameKey(name) ||
            otherNames.length > 0 ||
            (existing.address &&
              normalizeMemberName(existing.address).toLowerCase() !== address.toLowerCase())
          ) {
            throw new MembershipRegistrationConflict(
              "IDENTITY_CONFLICT",
              "The existing profile or historical names do not match. Review this phone before enrolling.",
              currentProfile
            );
          }
          if (!confirmExistingProfile) {
            throw new MembershipRegistrationConflict(
              "EXISTING_PROFILE_CONFIRMATION_REQUIRED",
              "This phone already has a customer profile. Verify the person's identity and explicitly confirm enrollment.",
              currentProfile
            );
          }
          const number = `MEM-${String(existing.id).padStart(6, "0")}`;
          const changed = await tx.customer.updateMany({
            where: {
              id: existing.id,
              membershipNumber: null,
              memberSince: null,
            },
            data: {
              membershipNumber: number,
              memberSince: new Date(),
              // Preserve the original name/address and every historical bill/visit.
              ...(existing.address ? {} : { address }),
            },
          });
          if (changed.count !== 1) {
            throw new MembershipRegistrationConflict(
              "ALREADY_MEMBER",
              "Membership was changed concurrently; refresh and review."
            );
          }
          return tx.customer.findUniqueOrThrow({
            where: { id: existing.id },
            select: {
              id: true, name: true, phone: true, address: true,
              membershipNumber: true, memberSince: true,
            },
          });
        }

        // IDs are derived from the database's unique customer primary key,
        // not from reading MAX(membership_number), avoiding sequence races.
        const created = await tx.customer.create({
          data: { name, phone, address },
          select: { id: true },
        });
        return tx.customer.update({
          where: { id: created.id },
          data: {
            membershipNumber: `MEM-${String(created.id).padStart(6, "0")}`,
            memberSince: new Date(),
          },
          select: {
            id: true, name: true, phone: true, address: true,
            membershipNumber: true, memberSince: true,
          },
        });
      });

      res.status(201).json({
        success: true,
        message: "Membership registered successfully.",
        data: member,
      });
    } catch (error) {
      if (error instanceof MembershipRegistrationConflict) {
        res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          ...(error.existingCustomer
            ? { existingCustomer: error.existingCustomer } : {}),
        });
        return;
      }
      if (
        typeof error === "object" && error !== null &&
        "code" in error && error.code === "P2002"
      ) {
        res.status(409).json({
          success: false,
          code: "MEMBERSHIP_CONFLICT",
          message: "This customer or membership number is already registered. Refresh and review.",
        });
        return;
      }
      console.error("Admin membership registration failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to register membership.",
      });
    }
  }
);

// Shared customer lookup for authenticated POS and OPD staff.
router.get(
  "/lookup",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const raw =
      typeof req.query.phone === "string"
        ? req.query.phone
        : "";

    const phone = raw.replace(/\D/g, "");

    if (!/^\d{7,10}$/.test(phone)) {
      res.status(400).json({
        success: false,
        message: "Enter a valid customer phone number.",
      });
      return;
    }

    try {
      // Only explicitly registered, non-voided members may be retrieved by phone.
      const customer = await prisma.customer.findFirst({
        where: {
          phone,
          membershipNumber: { not: null },
          memberSince: { not: null },
          voidedAt: null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          membershipNumber: true,
          memberSince: true,
        },
      });

      res.json({
        success: true,
        data: customer,
      });
    } catch (error) {
      console.error("Customer lookup failed:", error);
      res.status(500).json({
        success: false,
        message: "Customer lookup failed.",
      });
    }
  }
);

// Customer directory is restricted to administrators.
router.get(
  "/",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "";

    const requestedPage = Number(req.query.page || 1);
    const page =
      Number.isSafeInteger(requestedPage) &&
      requestedPage > 0
        ? Math.min(requestedPage, 10000)
        : 1;

    const take = 50;
    const skip = (page - 1) * take;

    const status = req.query.status === "voided" ? "voided" : "active";
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Safely purge voided members older than 30 days who have no linked financial/clinical records.
      await prisma.customer.deleteMany({
        where: {
          voidedAt: { lt: thirtyDaysAgo },
          bills: { none: {} },
          patients: { none: {} },
          procedureInvoices: { none: {} },
        },
      });

      // Membership directory excludes legacy non-member profiles.
      const where = {
        membershipNumber: { not: null },
        memberSince: { not: null },
        ...(status === "voided"
          ? { voidedAt: { gte: thirtyDaysAgo } }
          : { voidedAt: null }),
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search.replace(/\D/g, "") || search } },
            { membershipNumber: { contains: search, mode: "insensitive" as const } },
          ],
        } : {}),
      };

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          orderBy: status === "voided" ? { voidedAt: "desc" } : { id: "desc" },
          skip,
          take,
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            createdAt: true,
            updatedAt: true,
            membershipNumber: true,
            memberSince: true,
            voidedAt: true,
            voidReason: true,
            _count: {
              select: {
                bills: true,
                patients: true,
              },
            },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      res.json({
        success: true,
        data: customers,
        pagination: {
          page,
          pageSize: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      console.error("Customer directory failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to load customers.",
      });
    }
  }
);

/**
 * Admin-only customer history.
 * POS and OPD retain independent financial and medical records.
 * Dates are interpreted as Nepal calendar dates (AD).
 */
router.get(
  "/:id/history",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
      return;
    }

    const from = typeof req.query.from === "string"
      ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string"
      ? req.query.to.trim() : "";

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      (from && !datePattern.test(from)) ||
      (to && !datePattern.test(to))
    ) {
      res.status(400).json({
        success: false,
        message: "Use YYYY-MM-DD for dates.",
      });
      return;
    }

    const fromDate = from
      ? new Date(`${from}T00:00:00+05:45`) : null;
    const toStart = to
      ? new Date(`${to}T00:00:00+05:45`) : null;

    if (
      (fromDate && Number.isNaN(fromDate.getTime())) ||
      (toStart && Number.isNaN(toStart.getTime())) ||
      (fromDate && toStart && fromDate > toStart)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid date range.",
      });
      return;
    }

    const toExclusive = toStart
      ? new Date(toStart.getTime() + 86400000) : null;

    const rawPage = Number(req.query.page ?? 1);
    const page = Number.isSafeInteger(rawPage) &&
      rawPage >= 1 && rawPage <= 100000
      ? rawPage : 1;

    // INDEPENDENT_HISTORY_129G
    const pageSize = 10;
    const readPage = (value: unknown): number => {
      const number = Number(value);
      return Number.isSafeInteger(number) &&
        number >= 1 && number <= 100000 ? number : 1;
    };
    const posPage = readPage(req.query.posPage ?? page);
    const opdPage = readPage(req.query.opdPage ?? page);
    const posSkip = (posPage - 1) * pageSize;
    const opdSkip = (opdPage - 1) * pageSize;
    const procPage = readPage(req.query.procPage ?? page);
    const procSkip = (procPage - 1) * pageSize;

    try {
      // History is accessible for registered members only.
      const customer = await prisma.customer.findFirst({
        where: {
          id,
          membershipNumber: { not: null },
          memberSince: { not: null },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          membershipNumber: true,
          memberSince: true,
          createdAt: true,
        },
      });

      if (!customer) {
        res.status(404).json({
          success: false,
          message: "Customer not found.",
        });
        return;
      }

      // Only explicitly verified links belong to a member's history.
      // Raw phone fallback can mix different people sharing a phone.
      const billWhere = {
        customerId: id,
        ...((fromDate || toExclusive) ? {
          transactionDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        } : {}),
      };

      const visitWhere = {
        patient: { customerId: id },
        ...((fromDate || toExclusive) ? {
          visitDateTime: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        } : {}),
      };

      const [bills, billCount, visits, visitCount] =
        await Promise.all([
          prisma.bill.findMany({
            where: billWhere,
            orderBy: [
              { transactionDate: "desc" },
              { id: "desc" },
            ],
            skip: posSkip,
            take: pageSize,
            select: {
              id: true,
              invoiceNumber: true,
              transactionDate: true,
              customerName: true,
              paymentMethod: true,
              paymentStatus: true,
              grandTotal: true,
              amountReceived: true,
              salesReturns: {
                select: { refundAmount: true },
              },
              items: {
                select: {
                  medicineNameSnapshot: true,
                  quantityInPack: true,
                  quantityInUnit: true,
                  netItemPrice: true,
                },
              },
            },
          }),
          prisma.bill.count({ where: billWhere }),
          prisma.clinicVisit.findMany({
            where: visitWhere,
            orderBy: [
              { visitDateTime: "desc" },
              { id: "desc" },
            ],
            skip: opdSkip,
            take: pageSize,
            select: {
              id: true,
              visitDateTime: true,
              status: true,
              consultationFee: true,
              additionalCharge: true,
              totalCharge: true,
              patient: {
                select: {
                  id: true,
                  name: true,
                },
              },
              doctor: {
                select: { name: true },
              },
            },
          }),
          prisma.clinicVisit.count({ where: visitWhere }),
        ]);

      // Procedure history is linked only to an explicitly selected member ID.
      // Do not derive membership from patient names or phone numbers.
      const procWhere = {
        customerId: id,
        ...((fromDate || toExclusive) ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toExclusive ? { lt: toExclusive } : {}),
          },
        } : {}),
      };
      const [procedureInvoices, procCount] = await Promise.all([
        prisma.procedureInvoice.findMany({
          where: procWhere,
          orderBy: { id: 'desc' },
          skip: procSkip,
          take: pageSize,
          select: {
            id: true, createdAt: true, patientName: true,
            paymentMethod: true, totalAmount: true,
            items: { select: { serviceName: true, lineTotal: true } },
          },
        }),
        prisma.procedureInvoice.count({ where: procWhere }),
      ]);

      const pos = bills.map((bill) => {
        const total = Number(bill.grandTotal);

        const returns = bill.salesReturns.reduce(
          (sum, item) => sum + Number(item.refundAmount),
          0
        );

        const received = Number(bill.amountReceived);

        const due =
          bill.paymentMethod === "credit" &&
          bill.paymentStatus !== "paid"
            ? Math.max(
                0,
                Math.round(
                  (total - returns - received) * 100
                ) / 100
              )
            : 0;

        return {
          id: bill.id,
          invoiceNumber: bill.invoiceNumber,
          date: bill.transactionDate,
          billedAs: bill.customerName,
          paymentMethod: bill.paymentMethod,
          paymentStatus: bill.paymentStatus,
          grandTotal: total,
          returnedAmount: returns,
          recordedAmountReceived: received,
          outstanding: due,
          medicines: bill.items.map((item) => ({
            name: item.medicineNameSnapshot ||
              "Historical medicine",
            packs: item.quantityInPack,
            units: item.quantityInUnit,
            netItemPrice: Number(item.netItemPrice),
          })),
        };
      });

      const opd = visits.map((visit) => ({
        id: visit.id,
        opdNumber: `OPD-${String(visit.id).padStart(6, "0")}`,
        date: visit.visitDateTime,
        patientName: visit.patient.name,
        patientId: visit.patient.id,
        doctorName: visit.doctor.name,
        status: visit.status,
        consultationFee: Number(visit.consultationFee),
        additionalCharge: Number(visit.additionalCharge),
        totalCharge: Number(visit.totalCharge),
      }));

      res.json({
        success: true,
        data: {
          customer,
          pos,
          opd,
          procedures: procedureInvoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: `PRC-${String(invoice.id).padStart(6, '0')}`,
            date: invoice.createdAt,
            patientName: invoice.patientName,
            paymentMethod: invoice.paymentMethod,
            totalAmount: Number(invoice.totalAmount),
            items: invoice.items.map(item => ({
              description: item.serviceName,
              amount: Number(item.lineTotal),
            })),
          })),
          pagination: {
            page,
            pageSize,
            posPage,
            opdPage,
            procPage,
            posTotal: billCount,
            opdTotal: visitCount,
            procTotal: procCount,
            procPages: Math.max(1, Math.ceil(procCount / pageSize)),
            posPages: Math.max(1, Math.ceil(billCount / pageSize)),
            opdPages: Math.max(1, Math.ceil(visitCount / pageSize)),
            totalPages: Math.max(
              1,
              Math.ceil(
                Math.max(billCount, visitCount, procCount) / pageSize
              )
            ),
          },
          note:
            "OPD amounts are recorded charges, not verified payment receipts.",
        },
      });
    } catch (error) {
      console.error("Customer history failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to load customer history.",
      });
    }
  }
);

// Admin-only soft-delete (void) of a registered member, retained for 30 days.
router.post(
  "/:id/void",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: "Invalid customer ID." });
      return;
    }

    const rawReason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim().replace(/\s+/g, " ").slice(0, 200)
        : "";
    const reason = rawReason || "Voided by admin";

    try {
      const existing = await prisma.customer.findFirst({
        where: {
          id,
          membershipNumber: { not: null },
          memberSince: { not: null },
        },
        select: { id: true, name: true, membershipNumber: true, voidedAt: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, message: "Registered member not found." });
        return;
      }

      if (existing.voidedAt) {
        res.status(409).json({ success: false, message: "This member is already voided." });
        return;
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          voidedAt: new Date(),
          voidReason: reason,
        },
        select: {
          id: true,
          name: true,
          membershipNumber: true,
          voidedAt: true,
          voidReason: true,
        },
      });

      res.json({
        success: true,
        message: `${updated.name} (${updated.membershipNumber}) voided and retained for 30 days.`,
        data: updated,
      });
    } catch (error) {
      console.error("Void member failed:", error);
      res.status(500).json({ success: false, message: "Unable to void member." });
    }
  }
);

// Admin-only restore of a voided member within the 30-day retention window.
router.post(
  "/:id/restore",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: "Invalid customer ID." });
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      const existing = await prisma.customer.findUnique({
        where: { id },
        select: { id: true, name: true, membershipNumber: true, voidedAt: true },
      });

      if (!existing || !existing.voidedAt) {
        res.status(404).json({ success: false, message: "Voided member not found." });
        return;
      }

      if (existing.voidedAt < thirtyDaysAgo) {
        res.status(410).json({
          success: false,
          message: "The 30-day restore window has expired for this voided member.",
        });
        return;
      }

      const restored = await prisma.customer.update({
        where: { id },
        data: {
          voidedAt: null,
          voidReason: null,
        },
        select: {
          id: true,
          name: true,
          membershipNumber: true,
        },
      });

      res.json({
        success: true,
        message: `${restored.name} (${restored.membershipNumber}) restored.`,
        data: restored,
      });
    } catch (error) {
      console.error("Restore member failed:", error);
      res.status(500).json({ success: false, message: "Unable to restore member." });
    }
  }
);

export default router;