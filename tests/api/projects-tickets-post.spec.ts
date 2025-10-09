import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: POST /api/projects/[projectId]/tickets
 * Validates API contract from contracts/api-projects-tickets-post.md
 *
 * This test MUST FAIL until the API endpoint is implemented
 */

test.describe('POST /api/projects/[projectId]/tickets - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should return 201 with created ticket for valid request', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Implement user authentication',
        description: 'Add email and password login with JWT tokens'
      }
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate response schema
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);

    expect(body).toHaveProperty('title', '[e2e] Implement user authentication');
    expect(body).toHaveProperty('description', 'Add email and password login with JWT tokens');

    // Contract requirement: stage MUST be INBOX for new tickets
    expect(body).toHaveProperty('stage', 'INBOX');

    // Contract requirement: version MUST be 1 for new tickets
    expect(body).toHaveProperty('version', 1);

    expect(body).toHaveProperty('createdAt');
    expect(typeof body.createdAt).toBe('string');
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);

    expect(body).toHaveProperty('updatedAt');
    expect(typeof body.updatedAt).toBe('string');
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  test('should create ticket with projectId from URL (not request body)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Test project scoping',
        description: 'Verify ticket gets correct projectId'
      }
    });

    expect(response.status()).toBe(201);
    const ticket = await response.json();

    // Verify the ticket exists in project 1 by fetching it
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(getResponse.status()).toBe(200);

    const allTickets = await getResponse.json();
    const foundTicket = allTickets.INBOX.find((t: any) => t.id === ticket.id);

    expect(foundTicket).toBeDefined();
    expect(foundTicket.title).toBe('[e2e] Test project scoping');
  });

  test('should return 400 for invalid projectId format', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/abc/tickets`, {
      data: {
        title: '[e2e] Test ticket',
        description: 'Should fail validation'
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid project ID');
  });

  test('should return 404 for non-existent project', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/999999/tickets`, {
      data: {
        title: '[e2e] Test ticket',
        description: 'Should fail - project does not exist'
      }
    });

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Project not found');
    expect(body).toHaveProperty('code', 'PROJECT_NOT_FOUND');
  });

  test('should return 400 for missing title', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        description: 'Missing title field'
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('title');
  });

  test('should return 400 for missing description', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Missing description'
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('description');
  });

  test('should return 400 for title exceeding 100 characters', async ({ request }) => {
    const longTitle = 'a'.repeat(101);

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: longTitle,
        description: 'Valid description'
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('100');
  });

  test('should return 400 for description exceeding 1000 characters', async ({ request }) => {
    const longDescription = 'a'.repeat(1001);

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Valid title',
        description: longDescription
      }
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('1000');
  });

  test('should trim whitespace from title and description', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e]   Trimmed title  ',
        description: '\n\nTrimmed description\n\n'
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.title).toBe('[e2e]   Trimmed title');
    expect(body.description).toBe('Trimmed description');
  });

  test('should allow empty title after trimming to fail validation', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '    ',
        description: 'Valid description'
      }
    });

    expect(response.status()).toBe(400);
  });

  test('should be queryable via GET after creation', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: '[e2e] Queryable ticket',
        description: 'Should appear in GET response'
      }
    });

    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Query tickets
    const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(getResponse.status()).toBe(200);

    const allTickets = await getResponse.json();
    const foundTicket = allTickets.INBOX.find((t: any) => t.id === created.id);

    expect(foundTicket).toBeDefined();
    expect(foundTicket.title).toBe('[e2e] Queryable ticket');
    expect(foundTicket.description).toBe('Should appear in GET response');
  });
});
