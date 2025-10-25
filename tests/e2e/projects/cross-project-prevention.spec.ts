import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';

/**
 * E2E Test: Cross-Project Access Prevention (T008)
 * User Story: As a system, I must prevent updates to tickets via wrong project context
 * Source: quickstart.md - Step 7
 *
 * This test MUST FAIL until cross-project validation is implemented
 */

test.describe('Cross-Project Access Prevention', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should return 403 when updating ticket via wrong project API', async ({ request }) => {
    // Create ticket in project 2
    const createResponse = await request.post(`${BASE_URL}/api/projects/2/tickets`, {
      data: {
        title: '[e2e] Ticket in project 2',
        description: 'Should not be updatable via project 1 API'
      }
    });

    // Skip test if project 2 doesn't exist
    if (createResponse.status() === 404) {
      test.skip();
      return;
    }

    expect(createResponse.status()).toBe(201);
    const ticket = await createResponse.json();

    // Attempt to transition via project 1's API (using /transition endpoint)
    const updateResponse = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'SPECIFY'
      }
    });

    // CRITICAL: Must return 404 (ticket not found in project 1) or 403 Forbidden
    expect([403, 404]).toContain(updateResponse.status());

    const body = await updateResponse.json();
    expect(body).toHaveProperty('error');
  });

  test('should not modify ticket when accessing via wrong project', async ({ request }) => {
    // Create ticket in project 2
    const createResponse = await request.post(`${BASE_URL}/api/projects/2/tickets`, {
      data: {
        title: '[e2e] Immutable ticket',
        description: 'Should not change'
      }
    });

    if (createResponse.status() === 404) {
      test.skip();
      return;
    }

    const ticket = await createResponse.json();

    // Attempt transition via wrong project (using /transition endpoint)
    await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'SPECIFY'
      }
    });

    // Verify ticket unchanged by fetching from correct project
    const getResponse = await request.get(`${BASE_URL}/api/projects/2/tickets`);
    expect(getResponse.status()).toBe(200);

    const tickets = await getResponse.json();
    const unchangedTicket = tickets.INBOX.find((t: any) => t.id === ticket.id);

    expect(unchangedTicket).toBeDefined();
    expect(unchangedTicket.stage).toBe('INBOX'); // Still in INBOX, not SPECIFY
    expect(unchangedTicket.version).toBe(1); // Version unchanged
  });

  test('should prevent reading tickets from other projects', async ({ request }) => {
    // Create ticket in project 2
    const createResponse = await request.post(`${BASE_URL}/api/projects/2/tickets`, {
      data: {
        title: '[e2e] Secret ticket',
        description: 'Should not appear in project 1'
      }
    });

    if (createResponse.status() === 404) {
      test.skip();
      return;
    }

    const ticket = await createResponse.json();

    // Fetch project 1 tickets
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(getResponse.status()).toBe(200);

    const tickets = await getResponse.json();
    const allTickets = [
      ...tickets.INBOX,
      ...tickets.SPECIFY,
      ...tickets.PLAN,
      ...tickets.BUILD,
      ...tickets.VERIFY,
      ...tickets.SHIP
    ];

    // Verify project 2 ticket is NOT in the list
    const leakedTicket = allTickets.find((t: any) => t.id === ticket.id);
    expect(leakedTicket).toBeUndefined();
  });

  test('should allow updating ticket via correct project API', async ({ request }) => {
    // Create ticket in project 1
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Valid ticket',
        description: 'Should be updatable'
      }
    });

    expect(createResponse.status()).toBe(201);
    const ticket = await createResponse.json();

    // Transition via correct project API (using /transition endpoint)
    const updateResponse = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'SPECIFY'
      }
    });

    // Should succeed
    expect(updateResponse.status()).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.stage).toBe('SPECIFY');
    expect(updated.version).toBe(2);
  });
});
