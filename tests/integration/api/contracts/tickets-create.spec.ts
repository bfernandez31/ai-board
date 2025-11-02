import { test, expect } from '../../../helpers/worker-isolation';
import { cleanupDatabase } from '../../../helpers/db-cleanup';

test.describe('Contract: POST /api/projects/:projectId/tickets', () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test (worker-specific isolation)
    await cleanupDatabase(projectId);
  });

  test('should return branch=null and autoMode=false for new ticket', async ({ request, projectId }) => {
    // Create a new ticket
    const response = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Test ticket for branch tracking',
          description: 'This ticket tests the default values for branch and autoMode',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Verify response structure
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('title', '[e2e] Test ticket for branch tracking');
    expect(ticket).toHaveProperty('description');
    expect(ticket).toHaveProperty('stage', 'INBOX');
    expect(ticket).toHaveProperty('version', 1);
    expect(ticket).toHaveProperty('projectId', projectId);
    expect(ticket).toHaveProperty('createdAt');
    expect(ticket).toHaveProperty('updatedAt');

    // CRITICAL: Verify new fields with default values
    expect(ticket).toHaveProperty('branch');
    expect(ticket.branch).toBeNull(); // Must be null, not undefined or empty string

    expect(ticket).toHaveProperty('autoMode');
    expect(ticket.autoMode).toBe(false); // Must be false (boolean)
  });

  test('should not accept branch or autoMode in creation request', async ({ request, projectId }) => {
    // Attempt to create ticket with branch and autoMode (should be ignored or rejected)
    const response = await request.post(
      `/api/projects/${projectId}/tickets`,
      {
        data: {
          title: '[e2e] Test ticket',
          description: 'Test description',
          branch: '014-should-be-ignored',
          autoMode: true,
        },
      }
    );

    // Depending on API design, this could be 201 (fields ignored) or 400 (strict validation)
    // For now, we expect creation to succeed but ignore the extra fields
    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Verify defaults are used, not the provided values
    expect(ticket.branch).toBeNull();
    expect(ticket.autoMode).toBe(false);
  });
});
