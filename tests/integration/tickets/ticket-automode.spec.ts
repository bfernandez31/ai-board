import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';

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
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test (worker-specific isolation)
    await cleanupDatabase(projectId);
  });

  test('should enable autoMode and persist to database', async ({ request, projectId }) => {
    // Step 1: Create ticket (autoMode should be false)
    const createResponse = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Ticket for automation testing',
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
      `/api/projects/${projectId}/tickets/${ticketId}`,
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
      `/api/projects/${projectId}/tickets/${ticketId}`
    );

    expect(getResponse.status()).toBe(200);

    const fetchedTicket = await getResponse.json();

    // Verify autoMode persisted correctly
    expect(fetchedTicket.autoMode).toBe(true);
    expect(fetchedTicket.title).toBe('[e2e] Ticket for automation testing');
  });

  test('should toggle autoMode from true to false', async ({ request, projectId }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Toggle test ticket',
          description: 'AutoMode will be toggled',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Enable autoMode
    await request.patch(`/api/projects/${projectId}/tickets/${ticketId}`, {
      data: { autoMode: true, version: 1 },
    });

    let fetchedTicket = await (
      await request.get(`/api/projects/${projectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.autoMode).toBe(true);

    // Disable autoMode (toggle back to false)
    await request.patch(`/api/projects/${projectId}/tickets/${ticketId}`, {
      data: { autoMode: false, version: 2 },
    });

    fetchedTicket = await (
      await request.get(`/api/projects/${projectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.autoMode).toBe(false);
  });

  test('should preserve other fields when updating autoMode', async ({ request, projectId }) => {
    // Create ticket with specific values
    const createResponse = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Field preservation test',
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
    await request.patch(`/api/projects/${projectId}/tickets/${ticketId}`, {
      data: { autoMode: true, version: 1 },
    });

    // Fetch ticket and verify other fields unchanged
    const fetchedTicket = await (
      await request.get(`/api/projects/${projectId}/tickets/${ticketId}`)
    ).json();

    expect(fetchedTicket.autoMode).toBe(true);
    expect(fetchedTicket.title).toBe(initialTitle);
    expect(fetchedTicket.description).toBe(initialDescription);
    expect(fetchedTicket.stage).toBe(initialStage);
    expect(fetchedTicket.branch).toBe(initialBranch); // Should remain null
    expect(fetchedTicket.createdAt).toBe(initialCreatedAt);

    // updatedAt should change
    expect(fetchedTicket.updatedAt).not.toBe(ticket.updatedAt);
  });

  test('should handle multiple tickets with different autoMode states', async ({ request, projectId }) => {
    // Create tickets with different autoMode settings
    const manualTicket = await (
      await request.post(`/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Manual ticket',
          description: 'Stays in manual mode',
        },
      })
    ).json();

    const autoTicket = await (
      await request.post(`/api/projects/${projectId}/tickets`, {
        data: {
          title: '[e2e] Auto ticket',
          description: 'Will be automated',
        },
      })
    ).json();

    // Enable autoMode for second ticket only
    await request.patch(
      `/api/projects/${projectId}/tickets/${autoTicket.id}`,
      {
        data: { autoMode: true, version: 1 },
      }
    );

    // Query both tickets
    const manual = await (
      await request.get(
        `/api/projects/${projectId}/tickets/${manualTicket.id}`
      )
    ).json();

    const auto = await (
      await request.get(
        `/api/projects/${projectId}/tickets/${autoTicket.id}`
      )
    ).json();

    // Verify different states
    expect(manual.autoMode).toBe(false);
    expect(auto.autoMode).toBe(true);
  });

  test('should maintain autoMode as boolean type (not truthy/falsy)', async ({ request, projectId }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Type check ticket',
          description: 'Verify boolean type',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set autoMode to true
    const updateResponse = await request.patch(
      `/api/projects/${projectId}/tickets/${ticketId}`,
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
  });

  test('should update updatedAt timestamp when autoMode changes', async ({ request, projectId }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Timestamp test',
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
      `/api/projects/${projectId}/tickets/${ticketId}`,
      {
        data: { autoMode: true, version: 1 },
      }
    );

    const updatedTicket = await updateResponse.json();
    const newUpdatedAt = new Date(updatedTicket.updatedAt);

    // Verify timestamp was updated
    expect(newUpdatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });
});
