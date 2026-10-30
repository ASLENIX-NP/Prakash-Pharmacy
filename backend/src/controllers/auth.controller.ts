import { Request, Response } from "express";
import { randomInt } from "node:crypto";
import { prisma } from "../db.js";
import { signJwt } from "../utils/jwt.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  verifyPassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
} from "../utils/user.helpers.js";

// In-memory recovery token store (valid for 15 minutes)
interface PasswordResetRecord {
  code: string;
  expiresAt: number;
  failedAttempts: number;
}

interface RateRecord {
  count: number;
  resetAt: number;
}

const passwordResetStore = new Map<string, PasswordResetRecord>();
const loginFailureStore = new Map<string, RateRecord>();
const forgotPasswordRateStore = new Map<string, RateRecord>();
const resetPasswordRateStore = new Map<string, RateRecord>();

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;
const MAX_FORGOT_REQUESTS = 5;
const MAX_RESET_REQUESTS = 10;
const MAX_OTP_FAILURES = 5;

// A fixed bcrypt hash keeps unknown-user login attempts close to the same
// computational cost as known-user attempts, reducing username timing leaks.
const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const requestIp = (req: Request): string =>
  String(req.ip || req.socket.remoteAddress || "unknown");

const rateKey = (req: Request, identity: unknown): string =>
  `${requestIp(req)}:${String(identity ?? "").trim().toLowerCase()}`;

const getAttemptCount = (store: Map<string, RateRecord>, key: string): number => {
  const current = store.get(key);
  if (!current || Date.now() >= current.resetAt) {
    if (current) store.delete(key);
    return 0;
  }
  return current.count;
};

const recordAttempt = (
  store: Map<string, RateRecord>,
  key: string,
  windowMs = AUTH_WINDOW_MS
): number => {
  const now = Date.now();
  const current = store.get(key);
  if (!current || now >= current.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  current.count += 1;
  return current.count;
};

const consumeRateLimit = (
  store: Map<string, RateRecord>,
  key: string,
  max: number
): boolean => {
  const count = recordAttempt(store, key);
  return count > max;
};

const invalidLogin = (res: Response): void => {
  res.status(401).json({
    success: false,
    message: "Invalid credentials or account unavailable.",
  });
};

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
    const loginKey = rateKey(req, cleanInput);

    if (getAttemptCount(loginFailureStore, loginKey) >= MAX_LOGIN_FAILURES) {
      res.status(429).json({
        success: false,
        message: "Too many failed login attempts. Please try again later.",
      });
      return;
    }

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
      // Deliberately perform a bcrypt comparison even for an unknown identity
      // so response timing does not become a useful account-existence oracle.
      await verifyPassword(String(password), DUMMY_PASSWORD_HASH);
      recordAttempt(loginFailureStore, loginKey);
      invalidLogin(res);
      return;
    }

    // Do not reveal whether the supplied identity is valid but inactive.
    if (user.status && user.status.toLowerCase() !== "active") {
      recordAttempt(loginFailureStore, loginKey);
      invalidLogin(res);
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      recordAttempt(loginFailureStore, loginKey);
      invalidLogin(res);
      return;
    }

    loginFailureStore.delete(loginKey);

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
// Change Logged-in User Password
// ==========================================
export async function changePassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authenticatedRequest =
      req as Request & {
        user?: { id: string };
      };

    if (!authenticatedRequest.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
      return;
    }

    const {
      currentPassword,
      newPassword
    } = req.body;

    if (
      !currentPassword ||
      !newPassword
    ) {
      res.status(400).json({
        success: false,
        message:
          "Current password and new password are required.",
      });
      return;
    }

    const cleanNewPassword =
      String(newPassword).trim();

    if (
      cleanNewPassword.length <
      MIN_PASSWORD_LENGTH
    ) {
      res.status(400).json({
        success: false,
        message:
          `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
      return;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: authenticatedRequest.user.id,
        },
      });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    if (
      user.status &&
      user.status.toLowerCase() !==
        "active"
    ) {
      res.status(403).json({
        success: false,
        message:
          "This staff account is not active.",
      });
      return;
    }

    const currentPasswordValid =
      await verifyPassword(
        String(currentPassword),
        user.password
      );

    if (!currentPasswordValid) {
      res.status(400).json({
        success: false,
        message:
          "Current password is incorrect.",
      });
      return;
    }

    const sameAsCurrent =
      await verifyPassword(
        cleanNewPassword,
        user.password
      );

    if (sameAsCurrent) {
      res.status(400).json({
        success: false,
        message:
          "New password must be different from the current password.",
      });
      return;
    }

    const hashedPassword =
      await hashPassword(
        cleanNewPassword
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({
      success: true,
      message:
        "Password changed successfully.",
    });

  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to change password.",
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

    const forgotKey = rateKey(req, cleanEmail);
    if (consumeRateLimit(forgotPasswordRateStore, forgotKey, MAX_FORGOT_REQUESTS)) {
      res.status(429).json({
        success: false,
        message: "Too many password recovery requests. Please try again later.",
      });
      return;
    }

    // Check if an eligible administrator exists, but never reveal the result
    // to the unauthenticated caller.
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: "insensitive",
        },
      },
    });

    if (user && user.role.toLowerCase() === "admin") {
      // Generate 6-digit secure code only for eligible administrator accounts.
      const resetCode = randomInt(100000, 1000000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      passwordResetStore.set(cleanEmail, {
        code: resetCode,
        expiresAt,
        failedAttempts: 0,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[PASSWORD RESET] Generated OTP ${resetCode} for ${cleanEmail} (User: ${user.username})`
        );
      }

      // Production still needs a configured email provider before self-service
      // recovery can be considered operational. Never return the OTP in
      // production responses.
    }

    res.status(200).json({
      success: true,
      message:
        "If an eligible administrator account exists for that email, a verification code has been sent.",
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

    const resetKey = rateKey(req, cleanEmail);
    if (consumeRateLimit(resetPasswordRateStore, resetKey, MAX_RESET_REQUESTS)) {
      res.status(429).json({
        success: false,
        message: "Too many password reset attempts. Please try again later.",
      });
      return;
    }

    if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        success: false,
        message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
      return;
    }

    const record = passwordResetStore.get(cleanEmail);

    if (!record) {
      res.status(400).json({
        success: false,
        message: "Verification code is invalid or expired. Request a new code if needed.",
      });
      return;
    }

    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(cleanEmail);
      res.status(400).json({
        success: false,
        message: "Verification code is invalid or expired. Request a new code if needed.",
      });
      return;
    }

    if (record.code !== cleanCode) {
      record.failedAttempts += 1;

      if (record.failedAttempts >= MAX_OTP_FAILURES) {
        passwordResetStore.delete(cleanEmail);
        res.status(429).json({
          success: false,
          message: "Too many invalid verification-code attempts. Request a new code.",
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: "Invalid verification code.",
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

    // Remove used code and its request throttle after a successful reset.
    passwordResetStore.delete(cleanEmail);
    resetPasswordRateStore.delete(resetKey);

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
