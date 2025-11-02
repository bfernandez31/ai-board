import { test, expect } from '../../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../../../helpers/db-cleanup';

test.describe('Selective Ticket Cleanup Contract', () => {
  const prisma = getPrismaClient();
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    // Worker-specific cleanup only
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test('should delete ALL tickets from test projects 1 and 2', async ({ projectId }) => {
    // Arrange - Create test tickets in worker-specific test project
    const projectKey = getProjectKey(projectId);
    const tickets = [
      { title: '[e2e] Test 1', description: 'Test', stage: 'INBOX' as const, projectId },
      { title: '[e2e] Test 2', description: 'Test', stage: 'INBOX' as const, projectId },
      { title: 'Manual Ticket', description: 'Manual', stage: 'INBOX' as const, projectId },
    ];

    for (const ticket of tickets) {
      const ticketNumber = nextTicketNumber++;
      await prisma.ticket.create({
        data: {
          ...ticket,
          ticketNumber,
          ticketKey: `${projectKey}-${ticketNumber}`, // Worker-specific ticketKey
          updatedAt: new Date(),
        },
      });
    }

    // Act
    await cleanupDatabase();

    // Assert - ALL tickets from worker-specific test project should be deleted
    const remaining = await prisma.ticket.findMany({ where: { projectId } });
    expect(remaining).toHaveLength(0);
  });

  test('should preserve tickets without [e2e] prefix in non-test projects', async ({ projectId }) => {
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

    // Arrange - Create a worker-isolated non-test project using high project ID (1000 + projectId)
    const nonTestProjectId = 1000 + projectId;
    const nonTestProjectKey = `PRD${projectId}`;
    const project = await prisma.project.create({
      data: {
        name: `Production Project ${projectId}`, // Worker-specific name
        description: 'Non-test project',
        githubOwner: `prod-owner-${projectId}`, // Worker-specific owner
        githubRepo: `prod-repo-${projectId}`, // Worker-specific repo
        key: nonTestProjectKey, // Worker-specific key
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    const tickets = [
      'Important Data',
      'e2e without brackets',
      '[test] Different prefix',
      'Suffix [e2e] position',
    ];

    let projectTicketNumber = 1;
    for (const title of tickets) {
      const ticketNumber = projectTicketNumber++;
      await prisma.ticket.create({
        data: {
          title,
          description: 'Test',
          stage: 'INBOX',
          projectId: project.id,
          ticketNumber,
          ticketKey: `${nonTestProjectKey}-${ticketNumber}`, // Worker-specific ticketKey
          updatedAt: new Date(),
        },
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

  test('should complete in <500ms for 100 tickets', async ({ projectId }) => {
    // Arrange: Create 100 test tickets in worker-specific project
    const projectKey = getProjectKey(projectId);
    for (let i = 0; i < 100; i++) {
      const ticketNumber = nextTicketNumber++;
      await prisma.ticket.create({
        data: {
          title: `[e2e] Test Ticket ${i}`,
          description: 'Test',
          stage: 'INBOX',
          projectId,
          ticketNumber,
          ticketKey: `${projectKey}-${ticketNumber}`, // Worker-specific ticketKey
          updatedAt: new Date(),
        },
      });
    }

    // Act
    const startTime = Date.now();
    await cleanupDatabase();
    const duration = Date.now() - startTime;

    // Assert
    expect(duration).toBeLessThan(500);

    // Verify cleanup worked for worker-specific project
    const remaining = await prisma.ticket.findMany({ where: { projectId } });
    expect(remaining).toHaveLength(0);
  });
});
