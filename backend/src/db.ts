import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  database?: string;
  user?: string;
  version?: string;
  error?: string;
}> {
  try {
    const result = await prisma.$queryRaw<
      Array<{ current_database: string; current_user: string; version: string }>
    >`SELECT current_database(), current_user, version();`;

    const row = result[0];
    return {
      connected: true,
      database: row?.current_database,
      user: row?.current_user,
      version: row?.version?.split(" on ")[0],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      error: message,
    };
  }
}
