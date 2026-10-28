import { Request, Response } from "express";
import { prisma } from "../db.js";
import { signJwt } from "../utils/jwt.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  verifyPassword,
  hashPassword,
} from "../utils/user.helpers.js";

// In-memory recovery token store (valid for 15 minutes)
interface PasswordResetRecord {
  code: string;
  expiresAt: number;
}
const passwordResetStore = new Map<string, PasswordResetRecord>();

// ==========================================
// 1. Login
// ==========================================
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "User ID / Username and Password are required.",
      });
      return;
    }

    const cleanInput = String(username).trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanInput, mode: "insensitive" } },
          { username: { equals: `${cleanInput}.staff`, mode: "insensitive" } },
          { id: { equals: cleanInput, mode: "insensitive" } },
          { email: { equals: cleanInput, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials. User does not exist.",
      });
      return;
    }

    // Block inactive / suspended accounts
    if (user.status && user.status.toLowerCase() !== "active") {
      res.status(403).json({
        success: false,
        message: `Staff login disabled. Account is currently ${user.status}. Please contact the admin.`,
      });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials. Incorrect password.",
      });
      return;
    }

    const token = signJwt({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during login.",
    });
  }
}

// ==========================================
// 2. Get Current Logged-in User Profile
// ==========================================
export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching user profile.",
    });
  }
}

// ==========================================
// 3. Forgot Password Request (by Email)
// ==========================================
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail.length > 254 || !emailRegex.test(cleanEmail)) {
      res.status(400).json({
        success: false,
        message: "Please provide a properly formatted email address.",
      });
      return;
    }

    // Check if user exists with this email
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: "insensitive",
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: `No administrator account is registered with ${cleanEmail}. Please verify the email or contact the pharmacy proprietor.`,
      });
      return;
    }

    // Restrict forgot password to Administrators only
    if (user.role.toLowerCase() !== "admin") {
      res.status(403).json({
        success: false,
        message: "Notice: Password self-recovery is strictly for Administrators only. Staff members must contact the Administrator to update their password.",
      });
      return;
    }

    // Generate 6-digit secure code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    passwordResetStore.set(cleanEmail, { code: resetCode, expiresAt });

    console.log(`[PASSWORD RESET] Generated OTP ${resetCode} for ${cleanEmail} (User: ${user.username})`);

    // In production, an email service (Nodemailer, SendGrid, Resend) sends this.
    // For local pharmacy dev environment, we return the code and simulate email transmission.
    res.status(200).json({
      success: true,
      message: `Password recovery verification code has been sent to ${cleanEmail}.`,
      email: cleanEmail,
      username: user.username,
      devCode: resetCode, // Provided for smooth local demo/testing
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process password recovery request.",
    });
  }
}

// ==========================================
// 4. Reset Password with Code
// ==========================================
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Email, 6-digit verification code, and new password are required.",
      });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(resetCode).trim();
    const cleanPassword = String(newPassword).trim();

    if (cleanPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long.",
      });
      return;
    }

    const record = passwordResetStore.get(cleanEmail);

    if (!record) {
      res.status(400).json({
        success: false,
        message: "No active password reset request found for this email. Please request a new code.",
      });
      return;
    }

    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(cleanEmail);
      res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      });
      return;
    }

    if (record.code !== cleanCode) {
      res.status(400).json({
        success: false,
        message: "Invalid verification code. Please check your email and try again.",
      });
      return;
    }

    // Hash new password and update user
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: "insensitive",
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    const hashedPassword = await hashPassword(cleanPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Remove used code
    passwordResetStore.delete(cleanEmail);

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
  }
}
