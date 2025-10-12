import { test, expect } from '@playwright/test';
import { getPrismaClient, cleanupDatabase } from '../helpers/db-cleanup';
import { createTestProject, createTestTicket } from '../helpers/db-setup';

/**
 * Project Cascade Delete Test
 *
 * Verifies that deleting a project automatically deletes all associated tickets.
 * This ensures referential integrity and prevents orphaned tickets in the database.
 *
 * Test Flow:
 * 1. Create project
 * 2. Create 3 tickets with projectId
 * 3. Delete project
 * 4. Verify all 3 tickets automatically deleted
 * 5. Confirm cascade delete works
 *
 * EXPECTED: Test PASSES after migration (database CASCADE DELETE constraint enforced)
 */

test.describe('Project Cascade Delete', () => {
  // Track projects created in each test for cleanup
  const createdProjectIds: number[] = [];

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
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

  test.afterAll(async () => {
    // Final cleanup after all tests
    await cleanupDatabase();
  });

  test('should cascade delete all tickets when project is deleted', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Cascade Test Project',
      description: 'Project for testing cascade delete',
      githubOwner: 'cascade-owner',
      githubRepo: 'cascade-repo',
    });

    // Create multiple tickets for this project
    const ticket1 = await createTestTicket(project.id, {
      title: '[e2e] Ticket 1',
      description: 'First ticket',
      stage: 'INBOX',
    });

    const ticket2 = await createTestTicket(project.id, {
      title: '[e2e] Ticket 2',
      description: 'Second ticket',
      stage: 'PLAN',
    });

    const ticket3 = await createTestTicket(project.id, {
      title: '[e2e] Ticket 3',
      description: 'Third ticket',
      stage: 'BUILD',
    });

    // Verify all tickets were created
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsBeforeDelete).toHaveLength(3);

    // Verify ticket IDs
    const ticketIds = ticketsBeforeDelete.map((t) => t.id).sort();
    expect(ticketIds).toContain(ticket1.id);
    expect(ticketIds).toContain(ticket2.id);
    expect(ticketIds).toContain(ticket3.id);

    // Delete the project
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify project was deleted
    const deletedProject = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(deletedProject).toBeNull();

    // Verify all tickets were automatically deleted (CASCADE DELETE)
    const ticketsAfterDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsAfterDelete).toHaveLength(0);

    // Verify no orphaned tickets remain for THIS test project
    // (Note: Project 3 may have tickets, so we don't check global count)
    const orphanedTickets = await prisma.ticket.findMany({
      where: {
        id: { in: [ticket1.id, ticket2.id, ticket3.id] }
      },
    });
    expect(orphanedTickets).toHaveLength(0);
  });

  test('should cascade delete tickets with different stages', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Multi-Stage Project',
      description: 'Project with tickets in various stages',
      githubOwner: 'multi-stage-owner',
      githubRepo: 'multi-stage-repo',
    });

    // Create tickets in all different stages
    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'] as const;

    for (const stage of stages) {
      await createTestTicket(project.id, {
        title: `Ticket in ${stage}`,
        description: `Ticket in ${stage} stage`,
        stage: stage,
      });
    }

    // Verify all tickets created (one per stage)
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsBeforeDelete).toHaveLength(6);

    // Delete the project
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify all tickets deleted regardless of stage
    const ticketsAfterDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsAfterDelete).toHaveLength(0);
  });

  test('should only delete tickets from the deleted project', async () => {
    const prisma = getPrismaClient();

    // Create first project with tickets
    const project1 = await createTestProject({
      name: 'Project 1',
      description: 'First project',
      githubOwner: 'owner1',
      githubRepo: 'repo1',
    });

    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 1',
      description: 'Ticket for project 1',
    });

    await createTestTicket(project1.id, {
      title: '[e2e] Project 1 - Ticket 2',
      description: 'Another ticket for project 1',
    });

    // Create second project with tickets
    const project2 = await createTestProject({
      name: 'Project 2',
      description: 'Second project',
      githubOwner: 'owner2',
      githubRepo: 'repo2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 1',
      description: 'Ticket for project 2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 2',
      description: 'Another ticket for project 2',
    });

    await createTestTicket(project2.id, {
      title: '[e2e] Project 2 - Ticket 3',
      description: 'Third ticket for project 2',
    });

    // Verify total ticket count
    const allTicketsBeforeDelete = await prisma.ticket.findMany({});
    expect(allTicketsBeforeDelete).toHaveLength(5);

    // Delete project 1
    await prisma.project.delete({
      where: { id: project1.id },
    });

    // Verify project 1 tickets are deleted
    const project1Tickets = await prisma.ticket.findMany({
      where: { projectId: project1.id },
    });
    expect(project1Tickets).toHaveLength(0);

    // Verify project 2 tickets still exist
    const project2Tickets = await prisma.ticket.findMany({
      where: { projectId: project2.id },
    });
    expect(project2Tickets).toHaveLength(3);

    // Verify only project 2 tickets remain (not project 1 tickets)
    // (Note: We don't check global count because project 3 may have tickets)
    const remainingTestTickets = await prisma.ticket.findMany({
      where: {
        projectId: { in: [project1.id, project2.id] }
      }
    });
    expect(remainingTestTickets).toHaveLength(3);
    expect(remainingTestTickets.every(t => t.projectId === project2.id)).toBe(true);
  });

  test('should handle cascade delete with large number of tickets', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Large Project',
      description: 'Project with many tickets',
      githubOwner: 'large-owner',
      githubRepo: 'large-repo',
    });

    // Create 50 tickets
    const ticketCount = 50;
    const ticketPromises = [];

    for (let i = 1; i <= ticketCount; i++) {
      ticketPromises.push(
        createTestTicket(project.id, {
          title: `Ticket ${i}`,
          description: `Ticket number ${i}`,
          stage: 'INBOX',
        })
      );
    }

    await Promise.all(ticketPromises);

    // Verify all tickets created
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsBeforeDelete).toHaveLength(ticketCount);

    // Delete the project
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify all tickets deleted
    const ticketsAfterDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsAfterDelete).toHaveLength(0);
  });

  test('should allow deleting project with no tickets', async () => {
    const prisma = getPrismaClient();

    // Create project without any tickets
    const project = await createTestProject({
      name: 'Empty Project',
      description: 'Project with no tickets',
      githubOwner: 'empty-owner',
      githubRepo: 'empty-repo',
    });

    // Verify project exists
    const projectBeforeDelete = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(projectBeforeDelete).toBeDefined();

    // Verify no tickets exist for this project
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsBeforeDelete).toHaveLength(0);

    // Delete the project (should succeed even with no tickets)
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify project was deleted
    const projectAfterDelete = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(projectAfterDelete).toBeNull();
  });

  test('should cascade delete tickets created at different times', async () => {
    const prisma = getPrismaClient();

    // Create test project
    const project = await createTestProject({
      name: 'Time Test Project',
      description: 'Project for testing cascade delete over time',
      githubOwner: 'time-owner',
      githubRepo: 'time-repo',
    });

    // Create first ticket
    await createTestTicket(project.id, {
      title: '[e2e] Old Ticket',
      description: 'Created first',
    });

    // Wait a bit (simulate time passing)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create second ticket
    await createTestTicket(project.id, {
      title: '[e2e] Newer Ticket',
      description: 'Created later',
    });

    // Wait again
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create third ticket
    await createTestTicket(project.id, {
      title: '[e2e] Newest Ticket',
      description: 'Created last',
    });

    // Verify all tickets exist
    const ticketsBeforeDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(ticketsBeforeDelete).toHaveLength(3);

    // Verify tickets have different creation times
    const creationTimes = ticketsBeforeDelete.map((t) => t.createdAt.getTime());
    expect(creationTimes[0]).toBeLessThan(creationTimes[1]);
    expect(creationTimes[1]).toBeLessThan(creationTimes[2]);

    // Delete the project
    await prisma.project.delete({
      where: { id: project.id },
    });

    // Verify all tickets deleted regardless of creation time
    const ticketsAfterDelete = await prisma.ticket.findMany({
      where: { projectId: project.id },
    });
    expect(ticketsAfterDelete).toHaveLength(0);
  });
});
