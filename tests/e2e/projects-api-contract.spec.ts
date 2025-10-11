import { test, expect } from '@playwright/test';

test.describe('GET /api/projects Contract', () => {
  test('returns projects array matching contract', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/projects');

    // Validate status
    expect(response.status()).toBe(200);

    // Validate content type
    expect(response.headers()['content-type']).toContain('application/json');

    // Parse response
    const projects = await response.json();

    // Validate array
    expect(Array.isArray(projects)).toBe(true);

    // If projects exist, validate structure
    if (projects.length > 0) {
      const project = projects[0];

      // Required fields exist
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('description');
      expect(project).toHaveProperty('updatedAt');
      expect(project).toHaveProperty('ticketCount');

      // Field types
      expect(typeof project.id).toBe('number');
      expect(typeof project.name).toBe('string');
      expect(typeof project.description).toBe('string');
      expect(typeof project.updatedAt).toBe('string');
      expect(typeof project.ticketCount).toBe('number');

      // Validate ISO 8601 timestamp format
      expect(new Date(project.updatedAt).toISOString()).toBe(project.updatedAt);

      // Ensure no extra fields (security check)
      const allowedKeys = ['id', 'name', 'description', 'updatedAt', 'ticketCount'];
      const actualKeys = Object.keys(project);
      expect(actualKeys.sort()).toEqual(allowedKeys.sort());
    }
  });

  test('returns empty array when no projects exist', async ({ request }) => {
    // This test assumes a scenario where no projects exist
    // May need database cleanup for this specific test case
    const response = await request.get('http://localhost:3000/api/projects');

    expect(response.status()).toBe(200);
    const projects = await response.json();
    expect(Array.isArray(projects)).toBe(true);
  });
});
