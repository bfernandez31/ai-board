import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: GET /api/projects/[projectId]/tickets
 * Validates API contract from contracts/api-projects-tickets-get.md
 *
 * This test MUST FAIL until the API endpoint is implemented
 */

test.describe('GET /api/projects/[projectId]/tickets - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test
    await cleanupDatabase(projectId);
  });

  test('should return 200 with tickets grouped by stage for valid project', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate all 6 stages are present (contract requirement)
    expect(body).toHaveProperty('INBOX');
    expect(body).toHaveProperty('SPECIFY');
    expect(body).toHaveProperty('PLAN');
    expect(body).toHaveProperty('BUILD');
    expect(body).toHaveProperty('VERIFY');
    expect(body).toHaveProperty('SHIP');

    // Each stage should be an array
    expect(Array.isArray(body.INBOX)).toBe(true);
    expect(Array.isArray(body.SPECIFY)).toBe(true);
    expect(Array.isArray(body.PLAN)).toBe(true);
    expect(Array.isArray(body.BUILD)).toBe(true);
    expect(Array.isArray(body.VERIFY)).toBe(true);
    expect(Array.isArray(body.SHIP)).toBe(true);
  });

  test('should return 400 for invalid projectId format (non-numeric)', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/abc/tickets`);

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid project ID');
  });

  test('should return 404 for non-existent project', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/999999/tickets`);

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Project not found');
    expect(body).toHaveProperty('code', 'PROJECT_NOT_FOUND');
  });

  test('should only return tickets from specified project (no leaks)', async ({ request , projectId }) => {
    // Create ticket in current worker's project
    const ticket1Response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: `[e2e] Ticket in project ${projectId}`,
        description: 'Should be visible'
      }
    });
    expect(ticket1Response.status()).toBe(201);
    const ticket1 = await ticket1Response.json();

    // Create ticket in different project (worker isolation pattern)
    // Each worker gets unique wrongProjectId (projectId + 10) to prevent race conditions
    const wrongProjectId = projectId + 10;
    await request.post(`${BASE_URL}/api/projects/${wrongProjectId}/tickets`, {
      data: {
        title: `[e2e] Ticket in project ${wrongProjectId}`,
        description: `Should NOT be visible in project ${projectId}`
      }
    });

    // Fetch tickets for current project
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets`);
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Collect all tickets from all stages
    const allTickets = [
      ...body.INBOX,
      ...body.SPECIFY,
      ...body.PLAN,
      ...body.BUILD,
      ...body.VERIFY,
      ...body.SHIP
    ];

    // Should have at least the ticket we created for project 1
    expect(allTickets.length).toBeGreaterThanOrEqual(1);

    // Verify the ticket we created is there
    const foundTicket = allTickets.find(t => t.id === ticket1.id);
    expect(foundTicket).toBeDefined();
    expect(foundTicket.title).toBe(`[e2e] Ticket in project ${projectId}`);

    // CRITICAL: Verify no tickets from other projects leaked through
    for (const ticket of allTickets) {
      // We can't check projectId directly if it's not in response, but we verified our ticket is there
      // and the count should not include wrongProjectId's ticket
      expect(ticket.title).not.toBe(`[e2e] Ticket in project ${wrongProjectId}`);
    }
  });

  test('should return tickets with correct schema when tickets exist', async ({ request , projectId }) => {
    // Create a test ticket in project 1
    const createResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Test ticket for GET contract validation',
        description: 'This ticket validates the GET endpoint contract'
      }
    });

    expect(createResponse.status()).toBe(201);

    // Now fetch all tickets for project 1
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets`);
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Find tickets in any stage
    let foundTicket = null;
    for (const stage of ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']) {
      if (body[stage].length > 0) {
        foundTicket = body[stage][0];
        break;
      }
    }

    expect(foundTicket).not.toBeNull();

    // Validate Ticket schema according to contract
    expect(foundTicket).toHaveProperty('id');
    expect(typeof foundTicket.id).toBe('number');
    expect(foundTicket.id).toBeGreaterThan(0);

    expect(foundTicket).toHaveProperty('title');
    expect(typeof foundTicket.title).toBe('string');
    expect(foundTicket.title.length).toBeGreaterThan(0);
    expect(foundTicket.title.length).toBeLessThanOrEqual(100);

    expect(foundTicket).toHaveProperty('description');
    expect(typeof foundTicket.description).toBe('string');
    expect(foundTicket.description.length).toBeLessThanOrEqual(1000);

    expect(foundTicket).toHaveProperty('stage');
    expect(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).toContain(foundTicket.stage);

    expect(foundTicket).toHaveProperty('version');
    expect(typeof foundTicket.version).toBe('number');
    expect(foundTicket.version).toBeGreaterThanOrEqual(1);

    expect(foundTicket).toHaveProperty('createdAt');
    expect(typeof foundTicket.createdAt).toBe('string');
    // Validate ISO 8601 date format
    expect(new Date(foundTicket.createdAt).toISOString()).toBe(foundTicket.createdAt);

    expect(foundTicket).toHaveProperty('updatedAt');
    expect(typeof foundTicket.updatedAt).toBe('string');
    expect(new Date(foundTicket.updatedAt).toISOString()).toBe(foundTicket.updatedAt);
  });

  test('should return empty arrays for all stages when project has no tickets', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets`);

    expect(response.status()).toBe(200);

    const body = await response.json();

    // All stages should be empty arrays
    expect(body.INBOX).toEqual([]);
    expect(body.SPECIFY).toEqual([]);
    expect(body.PLAN).toEqual([]);
    expect(body.BUILD).toEqual([]);
    expect(body.VERIFY).toEqual([]);
    expect(body.SHIP).toEqual([]);
  });
});
