import { PrismaClient } from '@prisma/client';

/**
 * Database cleanup utility for E2E tests
 * Ensures a clean state before each test run
 */

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function cleanupDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    // Delete all tickets to reset the database
    await client.ticket.deleteMany({});

    console.log('✓ Database cleaned successfully');
  } catch (error) {
    console.error('✗ Database cleanup failed:', error);
    throw error;
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
