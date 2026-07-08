import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Allow build to succeed without DATABASE_URL (Next.js collects page data at build time)
const databaseUrl = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  if (!databaseUrl) {
    // Return a proxy that throws on actual usage but allows import
    return new Proxy({} as PrismaClient, {
      get(_, prop) {
        if (prop === "then" || prop === "$connect" || prop === "$disconnect") return undefined;
        throw new Error("DATABASE_URL is not configured. Database features are unavailable.");
      },
    });
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
