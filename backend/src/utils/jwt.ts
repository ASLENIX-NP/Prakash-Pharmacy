import "dotenv/config";
import jwt from "jsonwebtoken";


const JWT_SECRET: string =
  (() => {
    const secret =
      process.env.JWT_SECRET?.trim();

    if (!secret) {
      throw new Error(
        "JWT_SECRET is required. Configure it in backend/.env before starting the server."
      );
    }

    return secret;
  })();


export interface TokenPayload {
  id: string;
  username: string;
  role: string;
}


export function signJwt(
  payload: TokenPayload,
  expiresIn:
    string | number = "7d"
): string {
  return jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn:
        expiresIn as jwt.SignOptions["expiresIn"],
    }
  );
}


export function verifyJwt(
  token: string
): TokenPayload | null {
  try {
    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    if (
      typeof decoded ===
      "string"
    ) {
      return null;
    }


    const {
      id,
      username,
      role,
    } = decoded;


    if (
      typeof id !==
        "string" ||
      typeof username !==
        "string" ||
      typeof role !==
        "string"
    ) {
      return null;
    }


    return {
      id,
      username,
      role,
    };
  } catch {
    return null;
  }
}
