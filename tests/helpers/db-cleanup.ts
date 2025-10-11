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
    // Delete ALL tickets from test projects 1 and 2 (to ensure clean state)
    await client.ticket.deleteMany({
      where: {
        projectId: { in: [1, 2] }
      }
    });

    // Delete only [e2e] prefixed tickets from other projects
    await client.ticket.deleteMany({
      where: {
        title: { startsWith: '[e2e]' },
        projectId: { notIn: [1, 2, 3] }
      }
    });

    // Delete only [e2e] prefixed projects EXCEPT projects 1, 2, and 3
    // Projects 1-2 are for tests, project 3 is for development
    await client.project.deleteMany({
      where: {
        name: { startsWith: '[e2e]' },
        id: { notIn: [1, 2, 3] }
      }
    });

    // Ensure test projects 1 and 2 exist with [e2e] prefix
    await client.project.upsert({
      where: { id: 1 },
      update: {}, // No update needed if exists
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
      },
    });

    await client.project.upsert({
      where: { id: 2 },
      update: {}, // No update needed if exists
      create: {
        id: 2,
        name: '[e2e] Test Project 2',
        description: 'Second project for cross-project tests',
        githubOwner: 'test',
        githubRepo: 'test2',
      },
    });

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
