import { Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  resolveNameFields,
  resolveFlexibleFields,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from "../utils/user.helpers.js";

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );

// ==========================================
// 1. Register New Staff / User (Admin Only)
// ==========================================
export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { username, password, initials, email } = req.body;
    const { firstName, lastName } = resolveNameFields(req.body);
    const { phone, shift, status, role } = resolveFlexibleFields(req.body);

    if (status !== undefined && !["active", "inactive"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Staff status must be either 'active' or 'inactive'.",
      });
      return;
    }

    // Validation
    if (!username || !password || !firstName) {
      res.status(400).json({
        success: false,
        message: "Full Staff Name, User ID / Username, and Password are required.",
      });
      return;
    }

    const cleanPassword =
      String(password).trim();

    const pwdCheck = validatePasswordStrength(cleanPassword);
    if (!pwdCheck.valid) {
      res.status(400).json({
        success: false,
        message: pwdCheck.message,
      });
      return;
    }

    const cleanPhone = phone ? String(phone).trim() : "";
    const cleanEmail = email ? String(email).trim() : "";
    if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
      res.status(400).json({ success: false, message: "Staff phone number must contain exactly 10 digits." });
      return;
    }
    if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      res.status(400).json({ success: false, message: "Please provide a valid staff email address." });
      return;
    }

    const cleanUsername = String(username).trim();
    const targetRole = role || "staff";
    const requestedId = req.body.id || req.body.staffId || req.body.staffCode;
    const passwordHash = await hashPassword(cleanPassword);

    const newUser = await prisma.$transaction(async (tx) => {
      // Serialize staff-code allocation and case-insensitive identity checks.
      // The primary key/username uniqueness constraints remain the final guard.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9042025)`;

      const existingUsername = await tx.user.findFirst({
        where: { username: { equals: cleanUsername, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingUsername) {
        throw new Error("DUPLICATE_USERNAME");
      }

      let cleanId: string;
      if (requestedId) {
        cleanId = String(requestedId).trim();
      } else {
        const prefix = targetRole === "admin" ? "ADM" : "STF";
        const existingIds = await tx.user.findMany({
          where: { id: { startsWith: `${prefix}-` } },
          select: { id: true },
        });
        let maxNum = 0;
        for (const row of existingIds) {
          const match = row.id.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
          if (match?.[1]) {
            const numeric = Number(match[1]);
            if (Number.isInteger(numeric) && numeric > maxNum) maxNum = numeric;
          }
        }
        cleanId = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
      }

      if (!cleanId) {
        throw new Error("INVALID_STAFF_ID");
      }

      const duplicateId = await tx.user.findFirst({
        where: { id: { equals: cleanId, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicateId) {
        throw new Error("DUPLICATE_STAFF_ID");
      }

      return tx.user.create({
        data: {
          id: cleanId,
          username: cleanUsername,
          password: passwordHash,
          firstName: String(firstName).trim(),
          lastName: String(lastName || firstName).trim(),
          initials: initials ? String(initials).trim() : null,
          email: cleanEmail || null,
          phoneNumber: cleanPhone || null,
          role: targetRole,
          shift: shift ? String(shift).trim() : null,
          status: status || "active",
        },
      });
    });

    res.status(201).json({
      success: true,
      message: `Staff user '${newUser.username}' created successfully with Staff ID ${newUser.id}.`,
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof Error && error.message === "DUPLICATE_USERNAME") {
      res.status(409).json({ success: false, message: "User ID / Username is already taken." });
      return;
    }
    if (error instanceof Error && error.message === "DUPLICATE_STAFF_ID") {
      res.status(409).json({ success: false, message: "Staff ID is already in use." });
      return;
    }
    if (error instanceof Error && error.message === "INVALID_STAFF_ID") {
      res.status(400).json({ success: false, message: "Staff ID cannot be empty." });
      return;
    }
    if (isUniqueConstraintError(error)) {
      res.status(409).json({
        success: false,
        message: "Staff ID or username already exists.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error during staff registration.",
    });
  }
}

// ==========================================
// 2. List All Users & Staff (Admin Only)
// ==========================================
export async function getAllUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(formatUserResponse),
    });
  } catch (error) {
    console.error("GetAllUsers error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching users.",
    });
  }
}

// ==========================================
// 3. Get Single Staff By ID (Admin Only)
// ==========================================
export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = String(req.params.id).trim();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({
        success: false,
        message: `User with ID '${userId}' not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("GetUserById error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching user details.",
    });
  }
}

// ==========================================
// 4. Update Staff Details, Shift & Status (Admin Only)
// ==========================================
export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = String(req.params.id).trim();

    // Verify user exists
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: `User with ID '${userId}' not found.`,
      });
      return;
    }

    // Build update payload from flexible fields
    const updateData: Record<string, unknown> = {};

    // Name fields
    const { firstName, lastName } = resolveNameFields(req.body);
    const inputName = req.body.name || req.body.fullName;
    if (inputName) {
      const parts = String(inputName).trim().split(/\s+/);
      updateData.firstName = parts[0];
      updateData.lastName = parts.slice(1).join(" ") || parts[0];
    }
    if (req.body.firstName !== undefined) updateData.firstName = String(req.body.firstName).trim();
    if (req.body.lastName !== undefined) updateData.lastName = String(req.body.lastName).trim();

    // Initials & Email
    if (req.body.initials !== undefined) updateData.initials = req.body.initials ? String(req.body.initials).trim() : null;
    if (req.body.email !== undefined) {
      const cleanEmail = req.body.email ? String(req.body.email).trim() : "";
      if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
        res.status(400).json({ success: false, message: "Please provide a valid staff email address." });
        return;
      }
      updateData.email = cleanEmail || null;
    }

    // Flexible alias fields
    const { phone, shift, status, role } = resolveFlexibleFields(req.body);
    if (status !== undefined && !["active", "inactive"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Staff status must be either 'active' or 'inactive'.",
      });
      return;
    }
    if (phone !== undefined) {
      const cleanPhone = phone ? String(phone).trim() : "";
      if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
        res.status(400).json({ success: false, message: "Staff phone number must contain exactly 10 digits." });
        return;
      }
      updateData.phoneNumber = cleanPhone || null;
    }
    if (role !== undefined) updateData.role = role;
    if (shift !== undefined) updateData.shift = shift ? String(shift).trim() : null;
    if (status !== undefined) updateData.status = status;

    // Password reset by admin
    if (req.body.password !== undefined) {
      const cleanPassword =
        String(req.body.password).trim();

      const pwdCheck = validatePasswordStrength(cleanPassword);
      if (!pwdCheck.valid) {
        res.status(400).json({
          success: false,
          message: pwdCheck.message,
        });
        return;
      }

      updateData.password =
        await hashPassword(cleanPassword);
    }

    const nextRole = String(updateData.role ?? existing.role).toLowerCase();
    const nextStatus = String(updateData.status ?? existing.status).toLowerCase();
    const existingIsActiveAdmin =
      existing.role.toLowerCase() === "admin" &&
      existing.status.toLowerCase() === "active";
    const remainsActiveAdmin =
      nextRole === "admin" && nextStatus === "active";

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Serialize operations that could remove the final active Admin.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9042026)`;

      if (existingIsActiveAdmin && !remainsActiveAdmin) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            id: { not: userId },
            role: { equals: "admin", mode: "insensitive" },
            status: { equals: "active", mode: "insensitive" },
          },
        });

        if (otherActiveAdmins === 0) {
          throw new Error("LAST_ACTIVE_ADMIN");
        }
      }

      return tx.user.update({
        where: { id: userId },
        data: updateData,
      });
    });

    res.status(200).json({
      success: true,
      message: `Staff user '${updatedUser.username}' updated successfully.${req.body.password ? " Password was also updated." : ""}`,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("UpdateUser error:", error);
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      res.status(409).json({
        success: false,
        message: "At least one active Admin account must remain.",
      });
      return;
    }
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ success: false, message: "Username already exists." });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error updating staff details.",
    });
  }
}

// ==========================================
// 5. Delete Staff Member (Admin Only)
// ==========================================
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = String(req.params.id).trim();

    // Prevent admin from deleting themselves
    if (req.user && req.user.id === userId) {
      res.status(400).json({
        success: false,
        message: "Cannot delete your own admin account while logged in.",
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      res.status(404).json({
        success: false,
        message: `User with ID '${userId}' not found.`,
      });
      return;
    }

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9042026)`;

      if (
        existing.role.toLowerCase() === "admin" &&
        existing.status.toLowerCase() === "active"
      ) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            id: { not: userId },
            role: { equals: "admin", mode: "insensitive" },
            status: { equals: "active", mode: "insensitive" },
          },
        });
        if (otherActiveAdmins === 0) {
          throw new Error("LAST_ACTIVE_ADMIN");
        }
      }

      const history = await tx.user.findUnique({
        where: { id: userId },
        select: {
          _count: {
            select: { bills: true, clinicVisits: true },
          },
        },
      });

      if (history && (history._count.bills > 0 || history._count.clinicVisits > 0)) {
        const deactivated = await tx.user.update({
          where: { id: userId },
          data: { status: "inactive" },
        });
        return { mode: "deactivated" as const, user: deactivated };
      }

      const deleted = await tx.user.delete({ where: { id: userId } });
      return { mode: "deleted" as const, user: deleted };
    });

    res.status(200).json({
      success: true,
      message:
        outcome.mode === "deactivated"
          ? `Staff user '${existing.username}' has historical transactions and was deactivated instead of deleted.`
          : `Staff user '${existing.username}' (ID: ${userId}) has been deleted successfully.`,
    });
  } catch (error) {
    console.error("DeleteUser error:", error);
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      res.status(409).json({
        success: false,
        message: "At least one active Admin account must remain.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error deleting user.",
    });
  }
}
