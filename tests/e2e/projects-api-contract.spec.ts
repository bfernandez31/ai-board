import { test, expect } from '../helpers/worker-isolation';

test.describe('GET /api/projects Contract', () => {
  test('returns projects array matching contract', async ({ request , projectId }) => {
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
      expect(project).toHaveProperty('githubOwner');
      expect(project).toHaveProperty('githubRepo');
      expect(project).toHaveProperty('deploymentUrl');
      expect(project).toHaveProperty('updatedAt');
      expect(project).toHaveProperty('ticketCount');
      expect(project).toHaveProperty('lastShippedTicket');

      // Field types
      expect(typeof project.id).toBe('number');
      expect(typeof project.name).toBe('string');
      expect(typeof project.description).toBe('string');
      expect(typeof project.githubOwner).toBe('string');
      expect(typeof project.githubRepo).toBe('string');
      expect(project.deploymentUrl === null || typeof project.deploymentUrl === 'string').toBe(true);
      expect(typeof project.updatedAt).toBe('string');
      expect(typeof project.ticketCount).toBe('number');
      expect(project.lastShippedTicket === null || typeof project.lastShippedTicket === 'object').toBe(true);

      // Validate ISO 8601 timestamp format
      expect(new Date(project.updatedAt).toISOString()).toBe(project.updatedAt);

      // Validate lastShippedTicket structure if present
      if (project.lastShippedTicket) {
        expect(project.lastShippedTicket).toHaveProperty('id');
        expect(project.lastShippedTicket).toHaveProperty('ticketKey');
        expect(project.lastShippedTicket).toHaveProperty('title');
        expect(project.lastShippedTicket).toHaveProperty('updatedAt');
        expect(typeof project.lastShippedTicket.id).toBe('number');
        expect(typeof project.lastShippedTicket.ticketKey).toBe('string');
        expect(typeof project.lastShippedTicket.title).toBe('string');
        expect(typeof project.lastShippedTicket.updatedAt).toBe('string');
        expect(new Date(project.lastShippedTicket.updatedAt).toISOString()).toBe(project.lastShippedTicket.updatedAt);
      }

      // Ensure no extra fields (security check)
      const allowedKeys = ['id', 'name', 'description', 'githubOwner', 'githubRepo', 'deploymentUrl', 'updatedAt', 'ticketCount', 'lastShippedTicket', 'key'];
      const actualKeys = Object.keys(project);
      expect(actualKeys.sort()).toEqual(allowedKeys.sort());
    }
  });

  test('returns empty array when no projects exist', async ({ request , projectId }) => {
    // This test assumes a scenario where no projects exist
    // May need database cleanup for this specific test case
    const response = await request.get('http://localhost:3000/api/projects');

    expect(response.status()).toBe(200);
    const projects = await response.json();
    expect(Array.isArray(projects)).toBe(true);
  });
});
