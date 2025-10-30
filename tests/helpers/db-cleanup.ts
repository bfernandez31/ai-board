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

/**
 * Get the test user ID without creating fixtures
 * Useful for getting the ID before tests run
 */
export async function getTestUserId(): Promise<string> {
  const client = getPrismaClient();
  const testUser = await client.user.findUnique({
    where: { email: 'test@e2e.local' },
  });
  return testUser?.id || 'test-user-id';
}

/**
 * Ensure test user and projects exist (called once in global setup)
 */
export async function ensureTestFixtures(): Promise<string> {
  const client = getPrismaClient();

  try {
    // Ensure test user exists for E2E tests
    const testUser = await client.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Ensure test projects 1 and 2 exist with [e2e] prefix and assigned to test user
    await client.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
        clarificationPolicy: 'AUTO', // Reset to default for test isolation
      },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        clarificationPolicy: 'AUTO', // Default policy
        updatedAt: new Date(), // Required: Project.updatedAt has no default
      },
    });

    await client.project.upsert({
      where: { id: 2 },
      update: {
        userId: testUser.id,
        clarificationPolicy: 'AUTO', // Reset to default for test isolation
      },
      create: {
        id: 2,
        name: '[e2e] Test Project 2',
        description: 'Second project for cross-project tests',
        githubOwner: 'test',
        githubRepo: 'test2',
        userId: testUser.id,
        clarificationPolicy: 'AUTO', // Default policy
        updatedAt: new Date(), // Required: Project.updatedAt has no default
      },
    });

    console.error('✓ Test fixtures ensured (user + 2 projects)');
    return testUser.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reachable =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

    if (message.includes("Can't reach database server") || reachable === 'P1001') {
      console.warn('⚠️ Skipping test fixtures: database unreachable.');
      return 'test-user-id'; // Default test user ID when database is unreachable
    }

    console.error('✗ Test fixtures setup failed:', error);
    throw error;
  }
}

/**
 * Clean test data (called before each test)
 * Fast operation - deletes tickets and resets project policies
 */
export async function cleanupDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    // Delete all tickets from test projects 1 and 2
    await client.ticket.deleteMany({
      where: {
        projectId: {
          in: [1, 2],
        },
      },
    });

    // Delete all ProjectMembers from test projects 1 and 2
    // Will be recreated in test beforeEach hooks
    await client.projectMember.deleteMany({
      where: {
        projectId: {
          in: [1, 2],
        },
      },
    });

    // Delete all accounts before deleting users (foreign key constraint)
    // Only delete accounts for test users (not preserved users)
    const preservedUserIds = [
      'test-user-id', // E2E Test User (global beforeEach)
      'user-alice', // Alice Smith (global beforeEach)
      'user-bob', // Bob Johnson (global beforeEach)
      'ai-board-system-user', // AI-BOARD system user (always present)
    ];

    await client.account.deleteMany({
      where: {
        userId: {
          notIn: preservedUserIds,
        },
      },
    });

    // Delete test users created by API tests and auth tests
    // Keep core test users that E2E tests recreate in global beforeEach
    await client.user.deleteMany({
      where: {
        AND: [
          {
            id: {
              notIn: preservedUserIds,
            },
          },
          {
            OR: [
              {
                email: {
                  contains: '@test.com', // API test users
                },
              },
              {
                email: {
                  contains: '@github.com', // Auth test users
                },
              },
              {
                id: {
                  startsWith: 'test-', // Auth test users with test- prefix
                },
              },
            ],
          },
        ],
      },
    });

    // Delete [e2e] tickets from projects 4+
    await client.ticket.deleteMany({
      where: {
        AND: [
          {
            projectId: {
              gte: 4,
            },
          },
          {
            title: {
              startsWith: '[e2e]',
            },
          },
        ],
      },
    });

    // Delete [e2e] projects (except 1, 2, 3)
    await client.project.deleteMany({
      where: {
        AND: [
          {
            id: {
              notIn: [1, 2, 3],
            },
          },
          {
            name: {
              startsWith: '[e2e]',
            },
          },
        ],
      },
    });

    // Reset test project policies to AUTO for test isolation
    await client.project.updateMany({
      where: {
        id: {
          in: [1, 2],
        },
      },
      data: {
        clarificationPolicy: 'AUTO',
      },
    });
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
