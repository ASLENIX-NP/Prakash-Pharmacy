import { createHmac, timingSafeEqual } from "node:crypto";

function getResetSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "PASSWORD_RESET_SECRET must contain at least 32 characters."
    );
  }

  return secret;
}

export function hashPasswordResetCode(
  userId: string,
  code: string
): string {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Invalid password reset code format.");
  }

  return createHmac("sha256", getResetSecret())
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function verifyPasswordResetCode(
  userId: string,
  code: string,
  expectedHash: string
): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(
    hashPasswordResetCode(userId, code),
    "hex"
  );

  const expected = Buffer.from(expectedHash, "hex");

  return timingSafeEqual(actual, expected);
}
