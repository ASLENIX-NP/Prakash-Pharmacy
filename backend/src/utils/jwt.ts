import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "prakash-pharmacy-jwt-secret-key-2026-secure";

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
}

export function signJwt(payload: TokenPayload, expiresIn: string | number = "7d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyJwt(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
