import { PrismaClient } from "@prisma/client";

// Evita crear múltiples instancias de PrismaClient con el hot-reload de Next.js en desarrollo.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
