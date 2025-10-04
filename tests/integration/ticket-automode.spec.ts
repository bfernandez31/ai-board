import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Test: AutoMode toggle (Scenario 3)
 *
 * Tests the autoMode flag behavior:
 * 1. Create ticket (autoMode should be false)
 * 2. Update autoMode to true via PATCH
 * 3. Query ticket to verify persistence
 * 4. Toggle back to false
 *
 * AutoMode controls whether automation scripts advance ticket stages.
 */
test.describe('Integration: AutoMode toggle', () => {
  let testProjectId: number;

  test.beforeAll(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'AutoMode Test Project',
        description: 'Project for testing autoMode flag',
        githubOwner: 'integration-test-owner',
        githubRepo: 'automode-test',
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

  test('should enable autoMode and persist to database', async ({
    request,
  }) => {
    // Step 1: Create ticket (autoMode should be false)
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Ticket for automation testing',
          description: 'This ticket will have autoMode enabled',
        },
      }
    );

    expect(createResponse.status()).toBe(201);

    const createdTicket = await createResponse.json();
    const ticketId = createdTicket.id;

    // Verify initial state: autoMode is false
    expect(createdTicket.autoMode).toBe(false);

    // Step 2: Enable autoMode via PATCH
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();

    // Verify autoMode is now true
    expect(updatedTicket.autoMode).toBe(true);

    // Step 3: Query ticket via GET to verify persistence
    const getResponse = await request.get(
      `/api/projects/${testProjectId}/tickets/${ticketId}`
    );

    expect(getResponse.status()).toBe(200);

    const fetchedTicket = await getResponse.json();

    // Verify autoMode persisted correctly
    expect(fetchedTicket.autoMode).toBe(true);
    expect(fetchedTicket.title).toBe('Ticket for automation testing');

    // Step 4: Verify in database directly
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    expect(dbTicket).not.toBeNull();
    expect(dbTicket!.autoMode).toBe(true);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should toggle autoMode from true to false', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Toggle test ticket',
          description: 'AutoMode will be toggled',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Enable autoMode
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: { autoMode: true, version: 1 },
    });

    let fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.autoMode).toBe(true);

    // Disable autoMode (toggle back to false)
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: { autoMode: false, version: 2 },
    });

    fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.autoMode).toBe(false);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should preserve other fields when updating autoMode', async ({
    request,
  }) => {
    // Create ticket with specific values
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Field preservation test',
          description: 'Verify other fields unchanged',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Capture initial values
    const initialTitle = ticket.title;
    const initialDescription = ticket.description;
    const initialStage = ticket.stage;
    const initialBranch = ticket.branch;
    const initialCreatedAt = ticket.createdAt;

    // Update only autoMode
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: { autoMode: true, version: 1 },
    });

    // Fetch ticket and verify other fields unchanged
    const fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();

    expect(fetchedTicket.autoMode).toBe(true);
    expect(fetchedTicket.title).toBe(initialTitle);
    expect(fetchedTicket.description).toBe(initialDescription);
    expect(fetchedTicket.stage).toBe(initialStage);
    expect(fetchedTicket.branch).toBe(initialBranch); // Should remain null
    expect(fetchedTicket.createdAt).toBe(initialCreatedAt);

    // updatedAt should change
    expect(fetchedTicket.updatedAt).not.toBe(ticket.updatedAt);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle multiple tickets with different autoMode states', async ({
    request,
  }) => {
    // Create tickets with different autoMode settings
    const manualTicket = await (
      await request.post(`/api/projects/${testProjectId}/tickets`, {
        data: {
          title: 'Manual ticket',
          description: 'Stays in manual mode',
        },
      })
    ).json();

    const autoTicket = await (
      await request.post(`/api/projects/${testProjectId}/tickets`, {
        data: {
          title: 'Auto ticket',
          description: 'Will be automated',
        },
      })
    ).json();

    // Enable autoMode for second ticket only
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${autoTicket.id}`,
      {
        data: { autoMode: true, version: 1 },
      }
    );

    // Query both tickets
    const manual = await (
      await request.get(
        `/api/projects/${testProjectId}/tickets/${manualTicket.id}`
      )
    ).json();

    const auto = await (
      await request.get(
        `/api/projects/${testProjectId}/tickets/${autoTicket.id}`
      )
    ).json();

    // Verify different states
    expect(manual.autoMode).toBe(false);
    expect(auto.autoMode).toBe(true);

    // Clean up
    await prisma.ticket.deleteMany({
      where: { id: { in: [manualTicket.id, autoTicket.id] } },
    });
  });

  test('should maintain autoMode as boolean type (not truthy/falsy)', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Type check ticket',
          description: 'Verify boolean type',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set autoMode to true
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: true, version: 1 },
      }
    );

    const updatedTicket = await updateResponse.json();

    // Strict boolean type checks
    expect(updatedTicket.autoMode).toBe(true);
    expect(updatedTicket.autoMode).not.toBe(1);
    expect(updatedTicket.autoMode).not.toBe('true');
    expect(typeof updatedTicket.autoMode).toBe('boolean');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should update updatedAt timestamp when autoMode changes', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Timestamp test',
          description: 'Testing updatedAt changes',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;
    const initialUpdatedAt = new Date(ticket.updatedAt);

    // Wait a moment to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update autoMode
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: true, version: 1 },
      }
    );

    const updatedTicket = await updateResponse.json();
    const newUpdatedAt = new Date(updatedTicket.updatedAt);

    // Verify timestamp was updated
    expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });
});
