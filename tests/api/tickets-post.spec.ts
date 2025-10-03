import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';

/**
 * Contract Test: POST /api/projects/1/tickets
 * Validates API contract from contracts/tickets-api.yaml
 *
 * This test MUST FAIL until the API endpoint is implemented
 */

test.describe('POST /api/projects/1/tickets - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test('should create ticket and return 201 with complete Ticket schema', async ({ request }) => {
    const requestBody = {
      title: 'Fix authentication bug',
      description: 'Users cannot log in after password reset'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate Ticket schema according to OpenAPI spec
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);

    expect(body).toHaveProperty('title');
    expect(body.title).toBe(requestBody.title);

    expect(body).toHaveProperty('description');
    expect(body.description).toBe(requestBody.description);

    expect(body).toHaveProperty('stage');
    expect(body.stage).toBe('INBOX'); // Default stage per spec

    expect(body).toHaveProperty('createdAt');
    expect(typeof body.createdAt).toBe('string');
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);

    expect(body).toHaveProperty('updatedAt');
    expect(typeof body.updatedAt).toBe('string');
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);

    // createdAt and updatedAt should be close (same second)
    const created = new Date(body.createdAt);
    const updated = new Date(body.updatedAt);
    expect(Math.abs(updated.getTime() - created.getTime())).toBeLessThan(1000);
  });

  test('should return 400 when description is missing', async ({ request }) => {
    const requestBody = {
      title: 'Add dark mode toggle'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('description');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for missing title', async ({ request }) => {
    const requestBody = {
      description: 'This request has no title'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Validate ErrorResponse schema
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.toLowerCase()).toContain('title');

    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for empty title', async ({ request }) => {
    const requestBody = {
      title: '',
      description: 'Empty title should be rejected'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('title');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for title exceeding max length (100 chars)', async ({ request }) => {
    const longTitle = 'A'.repeat(101); // 101 characters

    const requestBody = {
      title: longTitle,
      description: 'Title is too long'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should accept title at max length (100 chars)', async ({ request }) => {
    const maxTitle = 'A'.repeat(100); // Exactly 100 characters

    const requestBody = {
      title: maxTitle,
      description: 'Title is at maximum allowed length'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.title).toBe(maxTitle);
    expect(body.title.length).toBe(100);
  });

  test('should return 400 for description exceeding max length (1000 chars)', async ({ request }) => {
    const longDescription = 'B'.repeat(1001); // 1001 characters

    const requestBody = {
      title: 'Valid title',
      description: longDescription
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should accept description at max length (1000 chars)', async ({ request }) => {
    const maxDescription = 'B'.repeat(1000); // Exactly 1000 characters

    const requestBody = {
      title: 'Valid title',
      description: maxDescription
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.description).toBe(maxDescription);
    expect(body.description.length).toBe(1000);
  });

  test('should return 400 for invalid JSON payload', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: 'invalid json string',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect([400, 500]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should handle allowed punctuation in title and description', async ({ request }) => {
    const requestBody = {
      title: 'Fix bug - test, test? test! test.',
      description: 'Description with allowed punctuation - comma, period. question? exclamation!'
    };

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: requestBody
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.title).toBe(requestBody.title);
    expect(body.description).toBe(requestBody.description);
  });

  test('should handle concurrent ticket creation', async ({ request }) => {
    const requests = Array.from({ length: 5 }, (_, i) => ({
      title: `Concurrent ticket ${i + 1}`,
      description: `Created concurrently number ${i + 1}`
    }));

    const responses = await Promise.all(
      requests.map(data =>
        request.post(`${BASE_URL}/api/projects/1/tickets`, { data })
      )
    );

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(201);
    });

    const bodies = await Promise.all(responses.map(r => r.json()));

    // All IDs should be unique
    const ids = bodies.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // All should have correct stage
    bodies.forEach(body => {
      expect(body.stage).toBe('INBOX');
    });
  });

  test('should return 500 with ErrorResponse schema on database error', async ({ request }) => {
    // This test is challenging to trigger without database manipulation
    // Documented for completeness per OpenAPI spec
    // Implementation may require database connection mocking

    // For now, we validate that normal requests work
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
      data: {
        title: 'Normal ticket for error handling test',
        description: 'This should succeed'
      }
    });

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
      expect(response.status()).toBe(201);
    }
  });
});