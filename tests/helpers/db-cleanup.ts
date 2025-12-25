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
 * Get the correct project key for a given projectId
 * Ensures consistency with global setup project keys
 */
export function getProjectKey(projectId: number): string {
  const keyMap: Record<number, string> = {
    1: 'E2E',
    2: 'TE2',
    4: 'TE4',
    5: 'TE5',
    6: 'TE6',
    7: 'TE7',
  };
  return keyMap[projectId] || `TE${projectId}`;
}

/**
 * Get worker-specific GitHub repo name for a given projectId
 * Returns unique repo names to avoid unique constraint violations
 */
export function getProjectGithub(projectId: number): { owner: string; repo: string } {
  const repoMap: Record<number, string> = {
    1: 'test',
    2: 'test2',
    4: 'test4',
    5: 'test5',
    6: 'test6',
    7: 'test7',
  };
  return {
    owner: 'test',
    repo: repoMap[projectId] || `test${projectId}`,
  };
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

    // Ensure test projects exist for workers (SKIP project 3 - reserved for dev!)
    // Projects: 1, 2, 4, 5, 6, 7, 8, 9, 10 for up to 9 parallel workers
    const workerProjects = [
      { id: 1, key: 'E2E', repo: 'test', name: '[e2e] Test Project' },
      { id: 2, key: 'TE2', repo: 'test2', name: '[e2e] Test Project 2' },
      { id: 4, key: 'TE4', repo: 'test4', name: '[e2e] Test Project 4' },
      { id: 5, key: 'TE5', repo: 'test5', name: '[e2e] Test Project 5' },
      { id: 6, key: 'TE6', repo: 'test6', name: '[e2e] Test Project 6' },
      { id: 7, key: 'TE7', repo: 'test7', name: '[e2e] Test Project 7' },
      { id: 8, key: 'TE8', repo: 'test8', name: '[e2e] Test Project 8' },
      { id: 9, key: 'TE9', repo: 'test9', name: '[e2e] Test Project 9' },
      { id: 10, key: 'T10', repo: 'test10', name: '[e2e] Test Project 10' },
    ];

    for (const project of workerProjects) {
      await client.project.upsert({
        where: { id: project.id },
        update: {
          userId: testUser.id,
          clarificationPolicy: 'AUTO', // Reset to default for test isolation
        },
        create: {
          id: project.id,
          key: project.key,
          name: project.name,
          description: `Worker project for parallel test execution`,
          githubOwner: 'test',
          githubRepo: project.repo,
          userId: testUser.id,
          clarificationPolicy: 'AUTO',
          updatedAt: new Date(),
        },
      });
    }

    console.error(`✓ Test fixtures ensured (user + ${workerProjects.length} worker projects)`);
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
 *
 * @param projectId Optional project ID for worker-specific cleanup (multi-worker safety)
 */
export async function cleanupDatabase(projectId?: number): Promise<void> {
  const client = getPrismaClient();

  try {
    // If projectId specified, only clean that project (worker-specific cleanup)
    // Otherwise clean all worker test projects (1, 2, 4, 5, 6, 7) - SKIP project 3 (dev)

    // Delete notifications first (foreign key to tickets)
    await client.notification.deleteMany({
      where: projectId
        ? { ticket: { projectId } }
        : {
            ticket: {
              projectId: {
                in: [1, 2, 4, 5, 6, 7],
              },
            },
          },
    });

    await client.ticket.deleteMany({
      where: projectId
        ? { projectId }
        : {
            projectId: {
              in: [1, 2, 4, 5, 6, 7],
            },
          },
    });

    // Delete all ProjectMembers from worker test projects (or specific project if provided)
    // Will be recreated in test beforeEach hooks
    await client.projectMember.deleteMany({
      where: projectId
        ? { projectId }
        : {
            projectId: {
              in: [1, 2, 4, 5, 6, 7],
            },
          },
    });

    // Delete all accounts before deleting users (foreign key constraint)
    // Only delete accounts for users that will be deleted (safer deletion strategy)
    const preservedUserIds = [
      'test-user-id', // E2E Test User (global beforeEach)
      'user-alice', // Alice Smith (global beforeEach)
      'user-bob', // Bob Johnson (global beforeEach)
      'ai-board-system-user', // AI-BOARD system user (always present)
    ];

    // Delete accounts ONLY for users that match deletion criteria (not all non-preserved users)
    // This prevents deleting accounts mid-test for users created by other workers
    await client.account.deleteMany({
      where: {
        user: {
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
                    startsWith: 'test-', // Legacy test users with test- prefix
                  },
                },
                {
                  id: {
                    startsWith: 'auth-', // Auth test users with auth- prefix
                  },
                },
              ],
            },
          ],
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
                  startsWith: 'test-', // Legacy test users with test- prefix
                },
              },
              {
                id: {
                  startsWith: 'auth-', // Auth test users with auth- prefix
                },
              },
            ],
          },
        ],
      },
    });

    // Delete project-specific test users (pattern: @project{N}.e2e.test)
    // Only delete for the specific project being cleaned to avoid race conditions
    if (projectId) {
      await client.user.deleteMany({
        where: {
          email: {
            endsWith: `@project${projectId}.e2e.test`,
          },
        },
      });
    } else {
      // Clean all worker project users when no specific project
      for (const pid of [1, 2, 4, 5, 6, 7]) {
        await client.user.deleteMany({
          where: {
            email: {
              endsWith: `@project${pid}.e2e.test`,
            },
          },
        });
      }
    }

    // Delete [e2e] tickets from projects 8+ (non-worker test projects)
    await client.ticket.deleteMany({
      where: {
        AND: [
          {
            projectId: {
              gte: 8,
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

    // Delete [e2e] projects (except 1, 2, 3, 4, 5, 6, 7)
    // Projects 1-7 are protected (1,2,4,5,6,7 for workers, 3 for dev)
    // This includes dynamic projects created by project-cascade.spec.ts tests
    await client.project.deleteMany({
      where: {
        AND: [
          {
            id: {
              notIn: [1, 2, 3, 4, 5, 6, 7],
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
      where: projectId
        ? { id: projectId }
        : {
            id: {
              in: [1, 2, 4, 5, 6, 7],
            },
          },
      data: {
        clarificationPolicy: 'AUTO',
      },
    });

    // Reset ticket number sequences for worker projects (or specific project if provided)
    // This prevents unique constraint violations on (projectId, ticketNumber)
    const projectsToReset = projectId ? [projectId] : [1, 2, 4, 5, 6, 7];
    for (const pid of projectsToReset) {
      await client.$executeRawUnsafe(`
        DROP SEQUENCE IF EXISTS project_${pid}_ticket_seq CASCADE;
      `);
    }
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

/**
 * Ensure a specific worker project exists with correct setup
 * Useful after cleanupDatabase() which may remove ProjectMembers
 *
 * @param projectId Worker project ID (1, 2, 4, 5, 6, 7)
 */
export async function ensureProjectExists(projectId: number): Promise<void> {
  const client = getPrismaClient();

  const projectKey = getProjectKey(projectId);
  const github = getProjectGithub(projectId);

  // Ensure test user exists
  const testUser = await client.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      id: 'test-user-id',
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Ensure project exists
  await client.project.upsert({
    where: { id: projectId },
    update: {
      userId: testUser.id,
      clarificationPolicy: 'AUTO',
    },
    create: {
      id: projectId,
      key: projectKey,
      name: `[e2e] Test Project ${projectKey}`,
      description: 'Worker project for parallel test execution',
      githubOwner: github.owner,
      githubRepo: github.repo,
      userId: testUser.id,
      clarificationPolicy: 'AUTO',
      updatedAt: new Date(),
    },
  });

  // Ensure AI-BOARD system user exists and is a project member
  const aiBoardUser = await client.user.upsert({
    where: { email: 'ai-board@system.local' },
    update: {},
    create: {
      id: 'ai-board-system-user',
      email: 'ai-board@system.local',
      name: 'AI-BOARD',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  // Ensure test user is a project member (ignore race condition errors)
  try {
    await client.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        projectId,
        userId: testUser.id,
        role: 'member',
      },
    });
  } catch (error: unknown) {
    // Ignore unique constraint errors (race condition with parallel workers)
    if (!(error instanceof Error) || !error.message.includes('Unique constraint')) {
      throw error;
    }
  }

  // Ensure AI-BOARD is a project member (ignore race condition errors)
  try {
    await client.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: aiBoardUser.id,
        },
      },
      update: {},
      create: {
        projectId,
        userId: aiBoardUser.id,
        role: 'member',
      },
    });
  } catch (error: unknown) {
    // Ignore unique constraint errors (race condition with parallel workers)
    if (!(error instanceof Error) || !error.message.includes('Unique constraint')) {
      throw error;
    }
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
