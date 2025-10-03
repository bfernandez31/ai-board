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

    // Ensure project 1 exists for tests
    const project1 = await client.project.findUnique({
      where: { id: 1 }
    });

    if (!project1) {
      await client.project.create({
        data: {
          id: 1,
          name: 'Test Project',
          description: 'Project for automated tests',
          githubOwner: 'test',
          githubRepo: 'test',
        },
      });
    }

    // Ensure project 2 exists for cross-project tests
    const project2 = await client.project.findUnique({
      where: { id: 2 }
    });

    if (!project2) {
      await client.project.create({
        data: {
          id: 2,
          name: 'Test Project 2',
          description: 'Second project for cross-project tests',
          githubOwner: 'test',
          githubRepo: 'test2',
        },
      });
    }

    console.log('✓ Database cleaned successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reachable =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

    if (message.includes("Can't reach database server") || reachable === 'P1001') {
      console.warn('⚠️ Skipping database cleanup: database unreachable.');
      return;
    }

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
