import { test, expect } from '../../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../../../helpers/db-cleanup';

test.describe('Selective Project Cleanup Contract', () => {
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    // Worker-specific cleanup only
    await cleanupDatabase(projectId);

    // Also delete temporary projects created by this test suite (worker-specific)
    await prisma.project.deleteMany({
      where: {
        OR: [
          { name: { startsWith: `[e2e] Temp Project ${projectId}` } },
          { name: { startsWith: `Production Project ${projectId}` } },
          { name: { startsWith: `Important Project ${projectId}` } },
          { name: { startsWith: `e2e without brackets ${projectId}` } },
          { name: { startsWith: `[prod] Different prefix ${projectId}` } },
          { name: { startsWith: `Suffix [e2e] position ${projectId}` } },
          { name: { startsWith: `[e2e] Temp 1 ${projectId}` } },
          { name: { startsWith: `[e2e] Temp 2 ${projectId}` } },
        ]
      }
    });
  });

  test('should delete only [e2e] prefixed projects', async ({ projectId }) => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
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

    // Arrange - Use worker-specific project data
    const projectKey = getProjectKey(projectId);
    await prisma.project.createMany({
      data: [
        {
          name: `[e2e] Temp Project ${projectId}`,
          description: 'Temp',
          githubOwner: `test-w${projectId}`,
          githubRepo: `temp1-w${projectId}`,
          key: `${projectKey}T1`,
          userId: testUser.id,
          updatedAt: new Date(), // Required field
          createdAt: new Date(), // Required field
        },
        {
          name: `Production Project ${projectId}`,
          description: 'Prod',
          githubOwner: `prod-w${projectId}`,
          githubRepo: `prod-w${projectId}`,
          key: `${projectKey}PR`,
          userId: testUser.id,
          updatedAt: new Date(), // Required field
          createdAt: new Date(), // Required field
        },
      ],
    });

    // Act
    await cleanupDatabase();

    // Assert
    const e2eProject = await prisma.project.findFirst({
      where: { name: `[e2e] Temp Project ${projectId}` },
    });
    const prodProject = await prisma.project.findFirst({
      where: { name: `Production Project ${projectId}` },
    });

    expect(e2eProject).toBeNull(); // Deleted
    expect(prodProject).not.toBeNull(); // Preserved
  });

  // NOTE: cleanupDatabase() does NOT recreate projects 1 and 2
  // That is the responsibility of ensureTestFixtures() in global setup
  // These tests were removed as they tested incorrect behavior

  test('should preserve projects without [e2e] prefix', async ({ projectId }) => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
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

    // Arrange - Use worker-specific project data
    const projectKey = getProjectKey(projectId);
    const projects = [
      { name: `Important Project ${projectId}`, repo: `important-project-w${projectId}` },
      { name: `e2e without brackets ${projectId}`, repo: `e2e-without-brackets-w${projectId}` },
      { name: `[prod] Different prefix ${projectId}`, repo: `prod-different-prefix-w${projectId}` },
      { name: `Suffix [e2e] position ${projectId}`, repo: `suffix-e2e-position-w${projectId}` },
    ];

    let projectKeyCounter = 1;
    for (const { name, repo } of projects) {
      await prisma.project.create({
        data: {
          name,
          description: 'Test',
          githubOwner: `test-w${projectId}`,
          githubRepo: repo,
          key: `${projectKey}P${projectKeyCounter++}`,
          userId: testUser.id,
          updatedAt: new Date(), // Required field
          createdAt: new Date(), // Required field
        },
      });
    }

    // Act
    await cleanupDatabase();

    // Assert
    for (const { name } of projects) {
      const preserved = await prisma.project.findFirst({ where: { name } });
      expect(preserved).not.toBeNull();
    }
  });

  test('should complete in <100ms', async ({ projectId }) => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
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

    // Arrange: Create some [e2e] projects - Use worker-specific project data
    const projectKey = getProjectKey(projectId);
    await prisma.project.createMany({
      data: [
        {
          name: `[e2e] Temp 1 ${projectId}`,
          description: 'Temp',
          githubOwner: `test-w${projectId}`,
          githubRepo: `temp1-w${projectId}`,
          key: `${projectKey}T1`,
          userId: testUser.id,
          updatedAt: new Date(), // Required field
          createdAt: new Date(), // Required field
        },
        {
          name: `[e2e] Temp 2 ${projectId}`,
          description: 'Temp',
          githubOwner: `test-w${projectId}`,
          githubRepo: `temp2-w${projectId}`,
          key: `${projectKey}T2`,
          userId: testUser.id,
          updatedAt: new Date(), // Required field
          createdAt: new Date(), // Required field
        },
      ],
    });

    // Act
    const startTime = Date.now();
    await cleanupDatabase();
    const duration = Date.now() - startTime;

    // Assert
    expect(duration).toBeLessThan(100);
  });
});
