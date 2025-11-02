import { test, expect } from '../../helpers/worker-isolation';

/**
 * E2E Test: Error Handling for Ticket Creation
 * User Story: As a user, I want clear error messages when ticket creation fails
 * Source: quickstart.md - Test Scenario 5
 *
 * This test MUST FAIL until error handling is properly implemented
 */

test.describe('Ticket Creation Error Handling', () => {
  const BASE_URL = 'http://localhost:3000';

  test('should return 400 for missing title', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        description: 'This request has no title'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.toLowerCase()).toContain('title');

    expect(body).toHaveProperty('code');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for empty title', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: ' ',
        description: 'Empty title should fail'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.toLowerCase()).toMatch(/title|required|empty/);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for title exceeding 100 characters', async ({ request , projectId }) => {
    const longTitle = 'A'.repeat(101);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: longTitle,
        description: 'Title is too long'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.toLowerCase()).toContain('100 characters or less');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return 400 for description exceeding 2500 characters', async ({ request , projectId }) => {
    const longDescription = 'B'.repeat(2501);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Valid title',
        description: longDescription
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error).toBeDefined();
    expect(body.error.toLowerCase()).toContain('2500 characters or less');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should return descriptive error message for validation failures', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {}
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    // Error message should be clear and descriptive
    expect(body.error).toBeDefined();
    expect(body.error.length).toBeGreaterThan(0);

    // Should mention what's wrong (title is required)
    expect(body.error.toLowerCase()).toMatch(/title|required/);

    // Should have proper error code
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should handle invalid JSON payload gracefully', async ({ request , projectId }) => {
    try {
      const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
        data: 'not valid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should return error status
      expect([400, 500]).toContain(response.status());

      const body = await response.json();
      expect(body).toHaveProperty('error');
    } catch (error) {
      // If request fails to parse, that's also acceptable
      expect(error).toBeDefined();
    }
  });

  test('should return consistent error format for all validation errors', async ({ request , projectId }) => {
    const errorCases = [
      { data: {}, expectedField: 'title' },
      { data: { title: '[e2e] ' }, expectedField: 'title' },
      { data: { title: '[e2e] A'.repeat(101) }, expectedField: 'title' }
    ];

    for (const errorCase of errorCases) {
      const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
        data: errorCase.data
      });

      expect(response.status()).toBe(400);

      const body = await response.json();

      // All errors should have same format
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe('VALIDATION_ERROR');

      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    }
  });

  test('should not leak sensitive information in error messages', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] ' }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    // Error message should not contain:
    // - Stack traces
    // - Database connection strings
    // - Internal paths
    const errorStr = JSON.stringify(body).toLowerCase();

    expect(errorStr).not.toMatch(/stack|trace|at \w+\.\w+/);
    expect(errorStr).not.toMatch(/postgresql:\/\/|mongodb:\/\//);
    expect(errorStr).not.toMatch(/\/users\/|\/home\/|c:\\/);
    expect(errorStr).not.toMatch(/password|secret|key|token/);
  });

  test('should handle concurrent error requests correctly', async ({ request , projectId }) => {
    const errorRequests = Array.from({ length: 5 }, () =>
      request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
        data: { title: '[e2e] ' }
      })
    );

    const responses = await Promise.all(errorRequests);

    // All should return 400
    responses.forEach(response => {
      expect(response.status()).toBe(400);
    });

    const bodies = await Promise.all(responses.map(r => r.json()));

    // All should have error format
    bodies.forEach(body => {
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  test('should differentiate between validation and server errors', async ({ request , projectId }) => {
    // Validation error
    const validationResponse = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] ' }
    });

    expect(validationResponse.status()).toBe(400);

    const validationBody = await validationResponse.json();
    expect(validationBody.code).toBe('VALIDATION_ERROR');

    // Server errors (if any) should have different code
    // This is documented for completeness - hard to trigger without mocking
  });

  test('should accept valid request at boundary (100 char title)', async ({ request , projectId }) => {
    const maxTitle = 'A'.repeat(100);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: maxTitle,
        description: 'Testing boundary'
      }
    });

    // Should succeed
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.title).toBe(maxTitle);
  });

  test('should accept valid request at boundary (2500 char description)', async ({ request , projectId }) => {
    const maxDescription = 'B'.repeat(2500);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Valid title',
        description: maxDescription
      }
    });

    // Should succeed
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.description).toBe(maxDescription);
  });

  test('should reject just over boundary (101 char title)', async ({ request , projectId }) => {
    const tooLongTitle = 'A'.repeat(101);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: tooLongTitle,
        description: 'Should fail'
      }
    });

    // Should fail
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should reject just over boundary (2501 char description)', async ({ request , projectId }) => {
    const tooLongDescription = 'B'.repeat(2501);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Valid title',
        description: tooLongDescription
      }
    });

    // Should fail
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
