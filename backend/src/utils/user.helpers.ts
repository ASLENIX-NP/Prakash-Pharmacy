import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

// ==========================================
// Type for a raw Prisma User row
// ==========================================
export interface UserRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  initials?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  role: string;
  shift?: string | null;
  status: string;
  createdAt?: Date;
}

// ==========================================
// Format a DB user row into a clean API response
// ==========================================
export function formatUserResponse(user: UserRow) {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const isActive = user.status.toLowerCase() === "active";
  const displayRole = user.role.toLowerCase() === "admin" ? "Admin" : "Staff";

  return {
    id: user.id,
    staffId: user.id,
    staffCode: user.id,
    name: fullName,
    fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: displayRole,
    phone: user.phoneNumber,
    phoneNumber: user.phoneNumber,
    email: user.email,
    shift: user.shift,
    shiftTiming: user.shift,
    status: user.status,
    isActive,
    initials: user.initials,
    createdAt: user.createdAt,
  };
}

// ==========================================
// Parse flexible name fields from request body
// Accepts: fullName, name, or firstName+lastName
// ==========================================
export function resolveNameFields(body: Record<string, any>): {
  firstName: string | undefined;
  lastName: string | undefined;
} {
  let firstName = body.firstName;
  let lastName = body.lastName;

  const inputName = body.name || body.fullName;
  if (inputName && (!firstName || !lastName)) {
    const parts = String(inputName).trim().split(/\s+/);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || parts[0] || "";
  }

  return { firstName, lastName };
}

// ==========================================
// Resolve fields that accept multiple aliases
// (phone/phoneNumber, shift/shiftTiming, status/isActive)
// ==========================================
export function resolveFlexibleFields(body: Record<string, any>) {
  // Phone: accepts "phone" or "phoneNumber"
  const phone =
    body.phone !== undefined ? body.phone : body.phoneNumber;

  // Shift: accepts "shiftTiming" or "shift"
  const shift =
    body.shiftTiming !== undefined ? body.shiftTiming : body.shift;

  // Status: accepts "status" string or "isActive" boolean
  let status: string | undefined;
  if (body.status !== undefined) {
    status = String(body.status).toLowerCase().trim();
  } else if (body.isActive !== undefined) {
    status = body.isActive ? "active" : "inactive";
  }

  // Role: normalise to lowercase "admin" or "staff"
  const role =
    body.role !== undefined
      ? String(body.role).toLowerCase() === "admin"
        ? "admin"
        : "staff"
      : undefined;

  return { phone, shift, status, role };
}

// ==========================================
// Auto-generate the next Staff Code
// e.g. STF-006, ADM-002
// ==========================================
export async function generateStaffCode(role: string): Promise<string> {
  const prefix = role === "admin" ? "ADM" : "STF";

  const existingWithPrefix = await prisma.user.findMany({
    where: { id: { startsWith: `${prefix}-` } },
    select: { id: true },
  });

  let maxNum = 0;
  for (const u of existingWithPrefix) {
    const match = u.id.match(new RegExp(`^${prefix}-(\\d+)`));
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }

  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

// ==========================================
// Hash a plaintext password
// ==========================================
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(String(plaintext), 10);
}

// ==========================================
// Compare a plaintext password against a hash
// ==========================================
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(String(plaintext), hash);
}
