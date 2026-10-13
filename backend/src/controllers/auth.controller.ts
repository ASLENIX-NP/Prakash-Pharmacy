import { Request, Response } from "express";
import { prisma } from "../db.js";
import { signJwt } from "../utils/jwt.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  formatUserResponse,
  verifyPassword,
} from "../utils/user.helpers.js";

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
