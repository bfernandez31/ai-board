import { test, expect } from '@playwright/test';
import { getPrismaClient } from '../helpers/db-cleanup';
import { createTestProject, createTestTicket, cleanupTestData } from '../helpers/db-setup';

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

test.describe('Ticket-Project Constraints', () => {
  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupTestData();
  });

  test.afterAll(async () => {
    // Cleanup after all tests
    await cleanupTestData();
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
      },
    });

    // Expected to fail due to foreign key constraint violation
    await expect(createPromise).rejects.toThrow();
  });

  test('should cascade delete tickets when project is deleted', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Cascade Test Project',
      description: 'Project for testing cascade delete',
      githubOwner: 'test-owner',
      githubRepo: 'cascade-test-repo',
    });

    // Create multiple tickets for this project
    await createTestTicket(project.id, {
      title: '[e2e] Ticket 1',
      description: 'First ticket',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 2',
      description: 'Second ticket',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 3',
      description: 'Third ticket',
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

    // Verify no orphaned tickets remain
    const allTickets = await prisma.ticket.findMany({});
    expect(allTickets).toHaveLength(0);
  });

  test('should return only tickets for specified project', async () => {
    const prisma = getPrismaClient();

    // Create two separate projects
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First project',
      githubOwner: 'owner1',
      githubRepo: 'repo1',
    });

    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second project',
      githubOwner: 'owner2',
      githubRepo: 'repo2',
    });

    // Create tickets for project 1
    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 1',
      description: 'First ticket for project 1',
    });

    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 2',
      description: 'Second ticket for project 1',
    });

    // Create tickets for project 2
    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 1',
      description: 'First ticket for project 2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 2',
      description: 'Second ticket for project 2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 3',
      description: 'Third ticket for project 2',
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

    // Verify total ticket count
    const allTickets = await prisma.ticket.findMany({});
    expect(allTickets).toHaveLength(5);
  });

  test('should allow querying tickets via project relation', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Relation Test Project',
      description: 'Project for testing relations',
      githubOwner: 'relation-owner',
      githubRepo: 'relation-repo',
    });

    // Create tickets
    await createTestTicket(project.id, {
      title: '[e2e] Ticket 1',
      description: 'First ticket',
      stage: 'INBOX',
    });

    await createTestTicket(project.id, {
      title: '[e2e] Ticket 2',
      description: 'Second ticket',
      stage: 'PLAN',
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
      },
    });

    // Expected to fail due to NOT NULL constraint
    await expect(createPromise).rejects.toThrow();
  });
});
