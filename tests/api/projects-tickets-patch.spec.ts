import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: PATCH /api/projects/[projectId]/tickets/[id]
 * Validates API contract from contracts/api-projects-tickets-patch.md
 *
 * This test MUST FAIL until the API endpoint is implemented
 */

test.describe('PATCH /api/projects/[projectId]/tickets/[id] - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  async function createTestTicket(request: any, projectId: number = 1) {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Test ticket',
        description: 'For patch testing'
      }
    });
    expect(response.status()).toBe(201);
    return await response.json();
  }

  test('should return 200 for valid stage update', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('id', ticket.id);
    expect(body).toHaveProperty('stage', 'SPECIFY');
    expect(body).toHaveProperty('version', 2); // Version incremented
    expect(body).toHaveProperty('updatedAt');
  });

  test('should return 200 for valid inline edit (title)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e] Updated title',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('id', ticket.id);
    expect(body).toHaveProperty('title', '[e2e] Updated title');
    expect(body).toHaveProperty('version', 2); // Version incremented
    expect(body).toHaveProperty('updatedAt');
  });

  test('should return 200 for valid inline edit (description)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        description: 'Updated description',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('description', 'Updated description');
    expect(body).toHaveProperty('version', 2);
  });

  test('should increment version on successful update', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // First update
    const response1 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });
    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    expect(body1.version).toBe(2);

    // Second update
    const response2 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'PLAN',
        version: 2
      }
    });
    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    expect(body2.version).toBe(3);
  });

  test('should return 403 for ticket in different project', async ({ request }) => {
    // Create ticket in project 2 (assuming it exists)
    const ticket = await createTestTicket(request, 2);

    // Try to update via project 1's API
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error', 'Forbidden');
  });

  test('should return 404 for non-existent project', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/999999/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Project not found');
  });

  test('should return 404 for non-existent ticket', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/999999`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Ticket not found');
  });

  test('should return 409 for version mismatch', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Update ticket to increment version
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    // Try to update with old version
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'PLAN',
        version: 1 // Should be 2 now
      }
    });

    expect(response.status()).toBe(409);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toMatch(/conflict|modified|version/);
  });

  test('should return 400 for invalid projectId format', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/abc/tickets/1`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid ticketId format', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/xyz`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid stage transition (skip stages)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'BUILD', // Skipping SPECIFY and PLAN
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('transition');
  });

  test('should return 400 for title exceeding 100 characters', async ({ request }) => {
    const ticket = await createTestTicket(request);
    const longTitle = 'a'.repeat(101);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: longTitle,
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for description exceeding 1000 characters', async ({ request }) => {
    const ticket = await createTestTicket(request);
    const longDescription = 'a'.repeat(1001);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        description: longDescription,
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should trim title and description', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e]   Trimmed title  ',
        description: '\n\nTrimmed description\n\n',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.title).toBe('[e2e]   Trimmed title');
    expect(body.description).toBe('Trimmed description');
  });

  test('should persist updates in database', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Update stage
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    // Verify via GET
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(getResponse.status()).toBe(200);

    const allTickets = await getResponse.json();
    const foundTicket = allTickets.SPECIFY.find((t: any) => t.id === ticket.id);

    expect(foundTicket).toBeDefined();
    expect(foundTicket.stage).toBe('SPECIFY');
    expect(foundTicket.version).toBe(2);
  });

  test('should allow sequential stage transitions', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // INBOX -> SPECIFY
    let response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'SPECIFY', version: 1 }
    });
    expect(response.status()).toBe(200);

    // SPECIFY -> PLAN
    response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'PLAN', version: 2 }
    });
    expect(response.status()).toBe(200);

    // PLAN -> BUILD
    response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'BUILD', version: 3 }
    });
    expect(response.status()).toBe(200);

    // BUILD -> VERIFY
    response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'VERIFY', version: 4 }
    });
    expect(response.status()).toBe(200);

    // VERIFY -> SHIP
    response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'SHIP', version: 5 }
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.stage).toBe('SHIP');
    expect(body.version).toBe(6);
  });

  test('should trigger GitHub workflow when stage changes (drag-and-drop)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // INBOX -> SPECIFY should trigger workflow
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'SPECIFY', version: 1 }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should include jobId in response when workflow is triggered
    expect(body).toHaveProperty('jobId');
    expect(body.jobId).toBeGreaterThan(0);

    // Branch should be NULL after transition (workflow will set it later via PATCH /branch)
    expect(body).toHaveProperty('branch');
    expect(body.branch).toBeNull();

    // Should update stage and version
    expect(body.stage).toBe('SPECIFY');
    expect(body.version).toBe(2);
  });

  test('should trigger workflow for inline edit with stage change', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Update both title and stage in single request
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e] Updated title with stage change',
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should include jobId when stage changes
    expect(body).toHaveProperty('jobId');
    expect(body.jobId).toBeGreaterThan(0);

    // Branch should be NULL after transition (workflow will set it later via PATCH /branch)
    expect(body).toHaveProperty('branch');
    expect(body.branch).toBeNull();

    // Should update both title and stage
    expect(body.title).toBe('[e2e] Updated title with stage change');
    expect(body.stage).toBe('SPECIFY');
  });

  test('should NOT trigger workflow when only title/description changes', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Update only title (no stage change)
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e] Only title updated',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should NOT include jobId when stage doesn't change
    expect(body.jobId).toBeUndefined();

    // Title should be updated
    expect(body.title).toBe('[e2e] Only title updated');

    // Stage should remain INBOX
    expect(body.stage).toBe('INBOX');
  });

  test('should NOT trigger workflow for manual stages (VERIFY, SHIP)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Transition to BUILD first (via multiple steps)
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'SPECIFY', version: 1 }
    });
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'PLAN', version: 2 }
    });
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'BUILD', version: 3 }
    });

    // BUILD -> VERIFY should NOT create job (manual stage)
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: { stage: 'VERIFY', version: 4 }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should NOT include jobId for manual stage
    expect(body.jobId).toBeUndefined();

    // Should update stage
    expect(body.stage).toBe('VERIFY');
  });
});
