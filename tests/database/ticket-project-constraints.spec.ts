import { test, expect } from '../helpers/worker-isolation';
import { getPrismaClient } from '../helpers/db-cleanup';
import { createTestProject, createTestTicket } from '../helpers/db-setup';

/**
 * Database constraint tests for Ticket-Project relationship
 *
 * These tests verify:
 * 1. Ticket creation without projectId fails (TypeScript + Prisma validation)
 * 2. Ticket creation with invalid projectId fails (foreign key violation)
 * 3. Project deletion cascades to all tickets (CASCADE DELETE)
 * 4. Project-scoped ticket queries return correct results
 *
 * EXPECTED: All tests will FAIL until schema migration is completed (TDD approach)
 */

// Helper: Generate unique ID for multi-worker isolation
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

test.describe('Ticket-Project Constraints', () => {
  // Track projects created in each test for cleanup
  const createdProjectIds: number[] = [];

  test.beforeEach(async () => {
    // Reset project tracking
    createdProjectIds.length = 0;
  });

  test.afterEach(async () => {
    // Clean up projects created in this test
    const prisma = getPrismaClient();
    if (createdProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: createdProjectIds } }
      });
    }
  });

  test('should fail to create ticket without projectId', async () => {
    const prisma = getPrismaClient();

    // This test verifies that projectId is required at the database level
    // We bypass TypeScript checking to test the database constraint
    const createPromise = prisma.$executeRaw`
      INSERT INTO "Ticket" ("title", "description", "stage", "version", "createdAt", "updatedAt")
      VALUES ('Test Ticket', 'Test description', 'INBOX', 1, NOW(), NOW())
    `;

    // Expected to fail because projectId is required (NOT NULL constraint)
    await expect(createPromise).rejects.toThrow();
  });

  test('should fail to create ticket with invalid projectId', async () => {
    const prisma = getPrismaClient();

    // Attempt to create ticket with non-existent projectId
    const createPromise = prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket',
        description: 'Test description',
        projectId: 99999, // Non-existent project ID
        ticketNumber: 1,
        ticketKey: 'TST-1',
        updatedAt: new Date(), // Required field
      },
    });

    // Expected to fail due to foreign key constraint violation
    await expect(createPromise).rejects.toThrow();
  });

  test('should cascade delete tickets when project is deleted', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create test project
    const project = await createTestProject({
      name: 'Cascade Test Project',
      description: 'Project for testing cascade delete',
      githubOwner: `test-owner-${id}`,
      githubRepo: `cascade-test-repo-${id}`,
      key: 'CAD',
    });
    createdProjectIds.push(project.id);

    // Create multiple tickets for this project
    await createTestTicket(project.id, {
      title: '[e2e] Ticket 1',
      description: 'First ticket',
      ticketNumber: 1,
      ticketKey: 'CAD-1',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 2',
      description: 'Second ticket',
      ticketNumber: 2,
      ticketKey: 'CAD-2',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 3',
      description: 'Third ticket',
      ticketNumber: 3,
      ticketKey: 'CAD-3',
    });

    // Verify tickets were created
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsBeforeDelete).toHaveLength(3);

    // Delete the project
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify all tickets were automatically deleted (CASCADE DELETE)
    const ticketsAfterDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsAfterDelete).toHaveLength(0);

    // Verify this project's tickets were deleted
    // (Note: Project 3 may have tickets, so we only check this project)
    const projectTickets = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(projectTickets).toHaveLength(0);
  });

  test('should return only tickets for specified project', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create two separate projects
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First project',
      githubOwner: `owner1-${id}`,
      githubRepo: `repo1-${id}`,
      key: 'P1',
    });
    createdProjectIds.push(project1.id);

    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second project',
      githubOwner: `owner2-${id}`,
      githubRepo: `repo2-${id}`,
      key: 'P2',
    });
    createdProjectIds.push(project2.id);

    // Create tickets for project 1
    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 1',
      description: 'First ticket for project 1',
      ticketNumber: 1,
      ticketKey: 'P1-1',
    });

    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 2',
      description: 'Second ticket for project 1',
      ticketNumber: 2,
      ticketKey: 'P1-2',
    });

    // Create tickets for project 2
    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 1',
      description: 'First ticket for project 2',
      ticketNumber: 1,
      ticketKey: 'P2-1',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 2',
      description: 'Second ticket for project 2',
      ticketNumber: 2,
      ticketKey: 'P2-2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 3',
      description: 'Third ticket for project 2',
      ticketNumber: 3,
      ticketKey: 'P2-3',
    });

    // Query tickets for project 1 only
    const project1Tickets = await prisma.ticket.findMany({
      where: { projectId: project1.id },
    });

    expect(project1Tickets).toHaveLength(2);
    expect(project1Tickets.every((t) => t.projectId === project1.id)).toBe(true);

    // Query tickets for project 2 only
    const project2Tickets = await prisma.ticket.findMany({
      where: { projectId: project2.id },
    });

    expect(project2Tickets).toHaveLength(3);
    expect(project2Tickets.every((t) => t.projectId === project2.id)).toBe(true);

    // Verify total ticket count for these test projects only
    // (Note: Project 3 may have tickets, so we only count test projects)
    const testTickets = await prisma.ticket.findMany({
      where: {
        projectId: { in: [project1.id, project2.id] }
      }
    });
    expect(testTickets).toHaveLength(5);
  });

  test('should allow querying tickets via project relation', async () => {
    const prisma = getPrismaClient();

    const id = uniqueId();
    // Create test project
    const project = await createTestProject({
      name: 'Relation Test Project',
      description: 'Project for testing relations',
      githubOwner: `relation-owner-${id}`,
      githubRepo: `relation-repo-${id}`,
      key: 'REL',
    });
    createdProjectIds.push(project.id);

    // Create tickets
    await createTestTicket(project.id, {
      title: '[e2e] Ticket 1',
      description: 'First ticket',
      stage: 'INBOX',
      ticketNumber: 1,
      ticketKey: 'REL-1',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 2',
      description: 'Second ticket',
      stage: 'PLAN',
      ticketNumber: 2,
      ticketKey: 'REL-2',
    });

    // Query project with tickets included
    const projectWithTickets = await prisma.project.findUnique({
      where: { id: project.id },
      include: { tickets: true },
    });

    expect(projectWithTickets).toBeDefined();
    expect(projectWithTickets?.tickets).toHaveLength(2);
    expect(projectWithTickets?.tickets.every((t) => t.projectId === project.id)).toBe(true);
  });

  test('should enforce projectId NOT NULL constraint', async () => {
    const prisma = getPrismaClient();

    // Attempt to create ticket with null projectId
    const createPromise = prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket',
        description: 'Test description',
        projectId: null as unknown as number, // Force null value
        ticketNumber: 1,
        ticketKey: 'TST-1',
        updatedAt: new Date(), // Required field
      },
    });

    // Expected to fail due to NOT NULL constraint
    await expect(createPromise).rejects.toThrow();
  });
});
