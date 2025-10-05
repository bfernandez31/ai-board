import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Test: Ticket creation with default values (Scenario 1)
 *
 * Tests that new tickets are created with correct default values:
 * - branch: null (not undefined, not empty string)
 * - autoMode: false (boolean, not truthy/falsy)
 *
 * This verifies the database schema defaults and API response format.
 */
test.describe('Integration: Ticket creation with default values', () => {
  let testProjectId: number;

  test.beforeAll(async () => {
    // Create a test project for integration testing
    const project = await prisma.project.create({
      data: {
        name: 'Integration Test Project',
        description: 'Project for integration testing default values',
        githubOwner: 'integration-test-owner',
        githubRepo: 'ticket-defaults-test',
      },
    });
    testProjectId = project.id;
  });

  test.afterAll(async () => {
    // Clean up all test data
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
    await prisma.$disconnect();
  });

  test('should create ticket with branch=null and autoMode=false by default', async ({
    request,
  }) => {
    // Create a new ticket via API
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Add branch tracking feature',
          description: 'Extend Ticket model with branch and autoMode fields',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Verify standard fields
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('title', 'Add branch tracking feature');
    expect(ticket).toHaveProperty(
      'description',
      'Extend Ticket model with branch and autoMode fields'
    );
    expect(ticket).toHaveProperty('stage', 'INBOX');
    expect(ticket).toHaveProperty('version', 1);
    expect(ticket).toHaveProperty('projectId', testProjectId);
    expect(ticket).toHaveProperty('createdAt');
    expect(ticket).toHaveProperty('updatedAt');

    // CRITICAL: Verify new fields with default values
    expect(ticket).toHaveProperty('branch');
    expect(ticket.branch).toBeNull(); // Must be null, not undefined or empty string

    expect(ticket).toHaveProperty('autoMode');
    expect(ticket.autoMode).toBe(false); // Must be exactly false (boolean)
    expect(typeof ticket.autoMode).toBe('boolean'); // Type check

    // Verify persistence by querying database directly
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    expect(dbTicket).not.toBeNull();
    expect(dbTicket!.branch).toBeNull();
    expect(dbTicket!.autoMode).toBe(false);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should maintain default values across multiple ticket creations', async ({
    request,
  }) => {
    // Create multiple tickets to ensure defaults are consistent
    const ticketIds: number[] = [];

    for (let i = 0; i < 3; i++) {
      const response = await request.post(
        `/api/projects/${testProjectId}/tickets`,
        {
          data: {
            title: `Test ticket ${i + 1}`,
            description: `Description for ticket ${i + 1}`,
          },
        }
      );

      expect(response.status()).toBe(201);

      const ticket = await response.json();
      ticketIds.push(ticket.id);

      // Verify each ticket has correct defaults
      expect(ticket.branch).toBeNull();
      expect(ticket.autoMode).toBe(false);
    }

    // Verify all tickets in database have correct defaults
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
    });

    expect(tickets).toHaveLength(3);
    tickets.forEach((ticket) => {
      expect(ticket.branch).toBeNull();
      expect(ticket.autoMode).toBe(false);
    });

    // Clean up
    await prisma.ticket.deleteMany({
      where: { id: { in: ticketIds } },
    });
  });

  test('should not change other existing fields when adding new defaults', async ({
    request,
  }) => {
    // Create a ticket and verify other fields are unchanged
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Verify existing fields',
          description: 'Ensure existing fields work correctly',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Verify all existing fields are present and correct
    expect(ticket.id).toBeGreaterThan(0);
    expect(ticket.title).toBe('Verify existing fields');
    expect(ticket.description).toBe('Ensure existing fields work correctly');
    expect(ticket.stage).toBe('INBOX');
    expect(ticket.version).toBe(1);
    expect(ticket.projectId).toBe(testProjectId);

    // Verify timestamps are valid dates
    expect(new Date(ticket.createdAt).getTime()).toBeGreaterThan(0);
    expect(new Date(ticket.updatedAt).getTime()).toBeGreaterThan(0);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should have null branch (not undefined or empty string)', async ({
    request,
  }) => {
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Test branch null type',
          description: 'Verify branch is exactly null',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Strict null check
    expect(ticket.branch).toBeNull();
    expect(ticket.branch).not.toBe(undefined);
    expect(ticket.branch).not.toBe('');
    expect(ticket.branch).not.toBe('null');

    // Type verification
    expect(ticket.branch === null).toBe(true);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should have autoMode as boolean false (not 0 or falsy)', async ({
    request,
  }) => {
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Test autoMode type',
          description: 'Verify autoMode is boolean false',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Strict boolean false check
    expect(ticket.autoMode).toBe(false);
    expect(ticket.autoMode).not.toBe(0);
    expect(ticket.autoMode).not.toBe('');
    expect(ticket.autoMode).not.toBe('false');
    expect(ticket.autoMode).not.toBe(null);
    expect(ticket.autoMode).not.toBe(undefined);

    // Type verification
    expect(typeof ticket.autoMode).toBe('boolean');
    expect(ticket.autoMode === false).toBe(true);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
