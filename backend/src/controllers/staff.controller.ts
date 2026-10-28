import { Response } from "express";
import { prisma } from "../db.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  resolveNameFields,
  resolveFlexibleFields,
  generateStaffCode,
  hashPassword,
} from "../utils/user.helpers.js";

// ==========================================
// 1. Register New Staff / User (Admin Only)
// ==========================================
export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { username, password, initials, email } = req.body;
    const { firstName, lastName } = resolveNameFields(req.body);
    const { phone, shift, status, role } = resolveFlexibleFields(req.body);

    // Validation
    if (!username || !password || !firstName) {
      res.status(400).json({
        success: false,
        message: "Full Staff Name, User ID / Username, and Password are required.",
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

    // Check duplicate username
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `User ID / Username '${cleanUsername}' is already taken.`,
      });
      return;
    }

    // Resolve staff code & role
    const targetRole = role || "staff";
    const finalId =
      req.body.id || req.body.staffId || req.body.staffCode ||
      (await generateStaffCode(targetRole));

    const newUser = await prisma.user.create({
      data: {
        id: String(finalId).trim(),
        username: cleanUsername,
        password: await hashPassword(password),
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

    res.status(201).json({
      success: true,
      message: `Staff user '${newUser.username}' created successfully with Staff ID ${newUser.id}.`,
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error("Registration error:", error);
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
    if (req.body.password) {
      if (String(req.body.password).length < 4) {
        res.status(400).json({
          success: false,
          message: "New password must be at least 4 characters long.",
        });
        return;
      }
      updateData.password = await hashPassword(req.body.password);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: `Staff user '${updatedUser.username}' updated successfully.${req.body.password ? " Password was also updated." : ""}`,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("UpdateUser error:", error);
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

    await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({
      success: true,
      message: `Staff user '${existing.username}' (ID: ${userId}) has been deleted successfully.`,
    });
  } catch (error) {
    console.error("DeleteUser error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error deleting user.",
    });
  }
}
