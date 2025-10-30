import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Common 404 Error Cases', () => {
  const endpoints = [
    '/api/projects/1/tickets/99999',
    '/api/projects/1/tickets/99999/comments',
    '/api/projects/1/tickets/99999/timeline',
    '/api/projects/1/tickets/99999/branch',
  ];

  endpoints.forEach(endpoint => {
    test(`should return 404 for non-existent resource: ${endpoint}`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      expect(response.status()).toBe(404);
    });
  });
});