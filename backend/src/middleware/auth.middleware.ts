import { Request, Response, NextFunction } from "express";
import { verifyJwt, TokenPayload } from "../utils/jwt.js";
import { prisma } from "../db.js";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token required. Format: Bearer <token>",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication token missing.",
    });
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
    return;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, status: true },
    });

    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
      return;
    }

    if (dbUser.status.toLowerCase() !== "active") {
      res.status(403).json({
        success: false,
        message: `Account is currently ${dbUser.status}. Access denied.`,
      });
      return;
    }

    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
    };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authorization verification.",
    });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role.toLowerCase() !== "admin") {
    res.status(403).json({
      success: false,
      message: "Forbidden. Admin privileges required.",
    });
    return;
  }
  next();
}
