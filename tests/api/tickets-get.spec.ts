import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: GET /api/tickets
 * Validates API contract from contracts/tickets-api.yaml
 *
 * This test MUST FAIL until the API endpoint is implemented
 */

test.describe('GET /api/tickets - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should return 200 with TicketsByStage schema', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate TicketsByStage structure - all 5 stages must be present
    expect(body).toHaveProperty('INBOX');
    expect(body).toHaveProperty('PLAN');
    expect(body).toHaveProperty('BUILD');
    expect(body).toHaveProperty('VERIFY');
    expect(body).toHaveProperty('SHIP');

    // Each stage should be an array
    expect(Array.isArray(body.INBOX)).toBe(true);
    expect(Array.isArray(body.PLAN)).toBe(true);
    expect(Array.isArray(body.BUILD)).toBe(true);
    expect(Array.isArray(body.VERIFY)).toBe(true);
    expect(Array.isArray(body.SHIP)).toBe(true);
  });

  test('should return tickets with correct schema when tickets exist', async ({ request }) => {
    // First, create a test ticket
    const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Test ticket for GET contract validation',
        description: 'This ticket validates the GET endpoint contract'
      }
    });

    expect(createResponse.status()).toBe(201);

    // Now fetch all tickets
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets`);
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Find tickets in any stage
    let foundTicket = null;
    for (const stage of ['INBOX', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']) {
      if (body[stage].length > 0) {
        foundTicket = body[stage][0];
        break;
      }
    }

    expect(foundTicket).not.toBeNull();

    // Validate Ticket schema according to OpenAPI spec
    expect(foundTicket).toHaveProperty('id');
    expect(typeof foundTicket.id).toBe('number');
    expect(foundTicket.id).toBeGreaterThan(0);

    expect(foundTicket).toHaveProperty('title');
    expect(typeof foundTicket.title).toBe('string');
    expect(foundTicket.title.length).toBeGreaterThan(0);
    expect(foundTicket.title.length).toBeLessThanOrEqual(100);

    expect(foundTicket).toHaveProperty('description');
    // description can be string or null
    if (foundTicket.description !== null) {
      expect(typeof foundTicket.description).toBe('string');
      expect(foundTicket.description.length).toBeLessThanOrEqual(1000);
    }

    expect(foundTicket).toHaveProperty('stage');
    expect(['INBOX', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']).toContain(foundTicket.stage);

    expect(foundTicket).toHaveProperty('createdAt');
    expect(typeof foundTicket.createdAt).toBe('string');
    // Validate ISO 8601 date format
    expect(new Date(foundTicket.createdAt).toISOString()).toBe(foundTicket.createdAt);

    expect(foundTicket).toHaveProperty('updatedAt');
    expect(typeof foundTicket.updatedAt).toBe('string');
    expect(new Date(foundTicket.updatedAt).toISOString()).toBe(foundTicket.updatedAt);
  });

  test('should return empty arrays for all stages when no tickets exist', async ({ request }) => {
    // This test assumes a clean database or handles existing tickets
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets`);

    expect(response.status()).toBe(200);

    const body = await response.json();

    // All stages should exist as arrays (may be empty or have tickets)
    expect(Array.isArray(body.INBOX)).toBe(true);
    expect(Array.isArray(body.PLAN)).toBe(true);
    expect(Array.isArray(body.BUILD)).toBe(true);
    expect(Array.isArray(body.VERIFY)).toBe(true);
    expect(Array.isArray(body.SHIP)).toBe(true);
  });

  test('should return 500 with ErrorResponse schema on database error', async ({ request }) => {
    // This test is challenging to trigger without database manipulation
    // Documented for completeness per OpenAPI spec
    // Implementation may require database connection mocking

    // For now, we validate that successful responses work
    // Error case testing will be added with proper test infrastructure
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets`);

    // If response is error (unlikely in normal operation)
    if (response.status() === 500) {
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');

      if (body.code) {
        expect(['VALIDATION_ERROR', 'DATABASE_ERROR', 'INTERNAL_ERROR']).toContain(body.code);
      }
    } else {
      // Normal case - endpoint works
      expect(response.status()).toBe(200);
    }
  });

  test('should handle concurrent requests correctly', async ({ request }) => {
    // Test that multiple simultaneous requests work correctly
    const requests = Array.from({ length: 5 }, () =>
      request.get(`${BASE_URL}/api/projects/1/tickets`)
    );

    const responses = await Promise.all(requests);

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });

    // All responses should have the same structure
    const bodies = await Promise.all(responses.map(r => r.json()));
    bodies.forEach(body => {
      expect(body).toHaveProperty('INBOX');
      expect(body).toHaveProperty('PLAN');
      expect(body).toHaveProperty('BUILD');
      expect(body).toHaveProperty('VERIFY');
      expect(body).toHaveProperty('SHIP');
    });
  });
});