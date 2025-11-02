import { test, expect } from '../helpers/worker-isolation';

const BASE_URL = 'http://localhost:3000';

test.describe('Common 404 Error Cases', () => {
  const endpointTemplates = [
    '/api/projects/{projectId}/tickets/99999',
    '/api/projects/{projectId}/tickets/99999/comments',
    '/api/projects/{projectId}/tickets/99999/timeline',
    '/api/projects/{projectId}/tickets/99999/branch',
  ];

  endpointTemplates.forEach(template => {
    test(`should return 404 for non-existent resource: ${template}`, async ({ request, projectId }) => {
      const endpoint = template.replace('{projectId}', String(projectId));
      const response = await request.get(`${BASE_URL}${endpoint}`);
      expect(response.status()).toBe(404);
    });
  });
});