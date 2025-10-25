import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: PATCH /api/projects/[projectId]/tickets/[id]
 * Validates inline editing (title, description, branch, autoMode, clarificationPolicy)
 *
 * Stage transitions now use POST /api/projects/[projectId]/tickets/[id]/transition
 */

test.describe('PATCH /api/projects/[projectId]/tickets/[id] - Inline Edit Only', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
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

  test('should return 400 when trying to update stage via PATCH (use /transition instead)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        stage: 'SPECIFY',
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toBe('Invalid request');
    expect(body.message).toContain('Stage transitions must use POST');
    expect(body.message).toContain('/transition');
  });

  test('should return 200 for valid inline edit (title)', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: 'Updated title',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('title', 'Updated title');
    expect(body).toHaveProperty('version', 2);
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

  test('should increment version on successful inline edit', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // First update
    const response1 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: 'Updated title',
        version: 1
      }
    });
    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    expect(body1.version).toBe(2);

    // Second update
    const response2 = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        description: 'Updated description',
        version: 2
      }
    });
    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    expect(body2.version).toBe(3);
  });

  test('should return 404 for non-existent project', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/999999/tickets/${ticket.id}`, {
      data: {
        title: 'Updated',
        version: 1
      }
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Project not found');
  });

  test('should return 400 for non-existent ticket (no fields to update)', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/999999`, {
      data: {
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.message).toContain('Must provide fields to update');
  });

  test('should return 409 for version mismatch', async ({ request }) => {
    const ticket = await createTestTicket(request);

    // Update ticket to increment version
    await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: 'First update',
        version: 1
      }
    });

    // Try to update with old version
    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: 'Second update',
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
        title: 'Updated',
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
        title: 'Updated',
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for title exceeding 100 characters', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: 'a'.repeat(101),
        version: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for description exceeding 1000 characters', async ({ request }) => {
    const ticket = await createTestTicket(request);

    const response = await request.patch(`${BASE_URL}/api/projects/1/tickets/${ticket.id}`, {
      data: {
        description: 'a'.repeat(1001),
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
        title: '  Trimmed Title  ',
        description: '  Trimmed Description  ',
        version: 1
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.title).toBe('Trimmed Title');
    expect(body.description).toBe('Trimmed Description');
  });
});
