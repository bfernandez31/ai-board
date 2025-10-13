import { test, expect } from '@playwright/test';
import { cleanupDatabase, getPrismaClient } from '../../../helpers/db-cleanup';

test.describe('Selective Ticket Cleanup Contract', () => {
  const prisma = getPrismaClient();

  test.beforeEach(async () => {
    // Start with clean database for each test
    await prisma.ticket.deleteMany({});

    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    // Ensure project 1 exists with [e2e] prefix (matches real test usage)
    await prisma.project.upsert({
      where: { id: 1 },
      update: {
        userId: testUser.id,
      },
      create: {
        id: 1,
        name: '[e2e] Test Project', // Use [e2e] prefix as real tests will
        description: 'Project for contract tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
      },
    });
  });

  test('should delete ALL tickets from test projects 1 and 2', async () => {
    // Arrange - Create test tickets in project 1 (test project)
    await prisma.ticket.createMany({
      data: [
        { title: '[e2e] Test 1', description: 'Test', stage: 'INBOX', projectId: 1 },
        { title: '[e2e] Test 2', description: 'Test', stage: 'INBOX', projectId: 1 },
        { title: 'Manual Ticket', description: 'Manual', stage: 'INBOX', projectId: 1 },
      ],
    });

    // Act
    await cleanupDatabase();

    // Assert - ALL tickets from project 1 should be deleted
    const remaining = await prisma.ticket.findMany({ where: { projectId: 1 } });
    expect(remaining).toHaveLength(0);
  });

  test('should preserve tickets without [e2e] prefix in non-test projects', async () => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    // Arrange - Create a non-test project (project ID > 2)
    const project = await prisma.project.create({
      data: {
        name: 'Production Project',
        description: 'Non-test project',
        githubOwner: 'prod',
        githubRepo: 'prod-repo',
        userId: testUser.id,
      },
    });

    const tickets = [
      'Important Data',
      'e2e without brackets',
      '[test] Different prefix',
      'Suffix [e2e] position',
    ];

    for (const title of tickets) {
      await prisma.ticket.create({
        data: { title, description: 'Test', stage: 'INBOX', projectId: project.id },
      });
    }

    // Act
    await cleanupDatabase();

    // Assert - All non-[e2e] tickets in non-test projects should be preserved
    const remaining = await prisma.ticket.findMany({ where: { projectId: project.id } });
    expect(remaining).toHaveLength(tickets.length);
    const remainingTitles = remaining.map((t) => t.title).sort();
    expect(remainingTitles).toEqual(tickets.sort());

    // Cleanup
    await prisma.ticket.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
  });

  test('should handle empty database gracefully', async () => {
    // Arrange: Empty database (already done in beforeEach)

    // Act & Assert: Should not throw
    await expect(cleanupDatabase()).resolves.not.toThrow();
  });

  test('should complete in <500ms for 100 tickets', async () => {
    // Arrange: Create 100 test tickets
    const tickets = Array.from({ length: 100 }, (_, i) => ({
      title: `[e2e] Test Ticket ${i}`,
      description: 'Test',
      stage: 'INBOX' as const,
      projectId: 1,
    }));
    await prisma.ticket.createMany({ data: tickets });

    // Act
    const startTime = Date.now();
    await cleanupDatabase();
    const duration = Date.now() - startTime;

    // Assert
    expect(duration).toBeLessThan(500);

    // Verify cleanup worked
    const remaining = await prisma.ticket.findMany();
    expect(remaining).toHaveLength(0);
  });
});
