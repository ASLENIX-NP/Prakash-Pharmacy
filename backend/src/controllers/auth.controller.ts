import { Request, Response } from "express";
import { randomInt } from "node:crypto";
import { hashPasswordResetCode, verifyPasswordResetCode } from "../utils/password-reset-code.js";
import { sendPasswordResetEmail } from "../services/password-reset-mail.service.js";
import { prisma } from "../db.js";
import { signJwt } from "../utils/jwt.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  verifyPassword,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from "../utils/user.helpers.js";

interface RateRecord {
  count: number;
  resetAt: number;
}

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
      tokenVersion: user.tokenVersion,
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

    const pwdCheck = validatePasswordStrength(cleanNewPassword);
    if (!pwdCheck.valid) {
      res.status(400).json({
        success: false,
        message: pwdCheck.message,
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
        tokenVersion: { increment: 1 },
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
    const { email } = req.body ?? {};

    if (!email || typeof email !== "string") {
      res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide a properly formatted email address.",
      });
      return;
    }

    const forgotKey = rateKey(req, cleanEmail);

    if (
      consumeRateLimit(
        forgotPasswordRateStore,
        forgotKey,
        MAX_FORGOT_REQUESTS
      )
    ) {
      res.status(429).json({
        success: false,
        message: "Too many password recovery requests. Please try again later.",
      });
      return;
    }

    const genericResponse = {
      success: true,
      message:
        "If an eligible administrator account exists for that email, a verification code has been sent.",
    };

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: "insensitive" },
        role: { equals: "admin", mode: "insensitive" },
        status: { equals: "active", mode: "insensitive" },
      },
    });

    if (user) {
      const resetCode = randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      let codeHash: string | undefined;

      try {
        codeHash = hashPasswordResetCode(user.id, resetCode);

        await prisma.passwordResetChallenge.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            codeHash,
            expiresAt,
            attempts: 0,
          },
          update: {
            codeHash,
            expiresAt,
            attempts: 0,
            requestedAt: new Date(),
          },
        });

        await sendPasswordResetEmail(user.email!, resetCode);
      } catch (error) {
        console.error(
          "[PASSWORD RESET] Could not create or deliver recovery code:",
          error instanceof Error ? error.name : "UnknownError"
        );

        if (codeHash) {
          try {
            await prisma.passwordResetChallenge.deleteMany({
              where: { userId: user.id, codeHash },
            });
          } catch {
            console.error(
              "[PASSWORD RESET] Failed to clean up undelivered code."
            );
          }
        }
      }
    }

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error(
      "Forgot password request failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
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
    const { email, resetCode, newPassword } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof resetCode !== "string" ||
      typeof newPassword !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Email, verification code, and new password are required.",
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = resetCode.trim();

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      !/^\d{6}$/.test(cleanCode)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid email or verification code format.",
      });
      return;
    }

    const resetKey = rateKey(req, cleanEmail);

    if (
      consumeRateLimit(
        resetPasswordRateStore,
        resetKey,
        MAX_RESET_REQUESTS
      )
    ) {
      res.status(429).json({
        success: false,
        message: "Too many reset attempts. Please try again later.",
      });
      return;
    }

    const pwdCheck = validatePasswordStrength(newPassword);

    if (!pwdCheck.valid) {
      res.status(400).json({
        success: false,
        message: pwdCheck.message,
      });
      return;
    }

    const invalidCode = () => {
      res.status(400).json({
        success: false,
        message: "Verification code is invalid or expired. Request a new code if needed.",
      });
    };

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: "insensitive" },
        role: { equals: "admin", mode: "insensitive" },
        status: { equals: "active", mode: "insensitive" },
      },
    });

    if (!user) {
      invalidCode();
      return;
    }

    const challenge = await prisma.passwordResetChallenge.findUnique({
      where: { userId: user.id },
    });

    if (!challenge) {
      invalidCode();
      return;
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await prisma.passwordResetChallenge.deleteMany({
        where: {
          id: challenge.id,
          codeHash: challenge.codeHash,
          expiresAt: { lte: new Date() },
        },
      });

      invalidCode();
      return;
    }

    if (challenge.attempts >= MAX_OTP_FAILURES) {
      invalidCode();
      return;
    }

    const codesMatch = verifyPasswordResetCode(
      user.id,
      cleanCode,
      challenge.codeHash
    );

    if (!codesMatch) {
      const updated = await prisma.passwordResetChallenge.updateMany({
        where: {
          id: challenge.id,
          userId: user.id,
          codeHash: challenge.codeHash,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_OTP_FAILURES },
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      if (updated.count > 0) {
        await prisma.passwordResetChallenge.deleteMany({
          where: {
            id: challenge.id,
            userId: user.id,
            codeHash: challenge.codeHash,
            attempts: { gte: MAX_OTP_FAILURES },
          },
        });
      }

      invalidCode();
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    const consumed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.passwordResetChallenge.deleteMany({
        where: {
          id: challenge.id,
          userId: user.id,
          codeHash: challenge.codeHash,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_OTP_FAILURES },
        },
      });

      if (deleted.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, tokenVersion: { increment: 1 } },
      });

      return true;
    });

    if (!consumed) {
      invalidCode();
      return;
    }

    resetPasswordRateStore.delete(resetKey);

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error instanceof Error ? error.name : "UnknownError"
    );

    res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
  }
}


// ==========================================
// 5. Switch Shift / Impersonate Staff (Admin Only)
// ==========================================
export async function switchShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "Target User ID is required to switch shift.",
      });
      return;
    }

    const cleanId = String(userId).trim();

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: { equals: cleanId, mode: "insensitive" } },
          { username: { equals: cleanId, mode: "insensitive" } },
        ],
      },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: `Target user '${cleanId}' not found.`,
      });
      return;
    }

    if (targetUser.status && targetUser.status.toLowerCase() !== "active") {
      res.status(400).json({
        success: false,
        message: `Cannot switch to '${targetUser.username}' because the account is deactivated.`,
      });
      return;
    }

    const token = signJwt({
      id: targetUser.id,
      username: targetUser.username,
      role: targetUser.role,
      tokenVersion: targetUser.tokenVersion,
    });

    res.status(200).json({
      success: true,
      message: `Shift switched to ${targetUser.firstName} ${targetUser.lastName} (@${targetUser.username}).`,
      token,
      user: formatUserResponse(targetUser),
    });
  } catch (error) {
    console.error("SwitchShift error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to switch shift.",
    });
  }
}

