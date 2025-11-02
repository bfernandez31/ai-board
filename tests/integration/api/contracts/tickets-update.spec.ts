import { test, expect } from '../../../helpers/worker-isolation';
import { cleanupDatabase } from '../../../helpers/db-cleanup';

test.describe('Contract: PATCH /api/projects/:projectId/tickets/:id', () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test (worker-specific isolation)
    await cleanupDatabase(projectId);
  });

  test('should accept and update branch field (string)', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          branch: '014-new-branch',
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.branch).toBe('014-new-branch');
    expect(typeof updated.branch).toBe('string');
  });

  test('should accept and update branch field (null)', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    // Set branch
    await request.patch(`/api/projects/${projectId}/tickets/${ticket.id}`, {
      data: { branch: '001-initial', version: 1 },
    });

    // Clear branch
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          branch: null,
          version: 2,
        },
      }
    );

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.branch).toBeNull();
  });

  test('should accept and update autoMode field', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.autoMode).toBe(true);
    expect(typeof updated.autoMode).toBe('boolean');
  });

  test('should validate branch max length (200 characters)', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          branch: 'a'.repeat(201),
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should update multiple fields including branch and autoMode', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          title: '[e2e] Updated',
          branch: '014-multi-update',
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.title).toBe('[e2e] Updated');
    expect(updated.branch).toBe('014-multi-update');
    expect(updated.autoMode).toBe(true);
  });

  test('should preserve other fields when updating branch', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Original', description: 'Original desc' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}`,
      {
        data: {
          branch: '014-new-branch',
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.branch).toBe('014-new-branch');
    expect(updated.title).toBe('[e2e] Original');
    expect(updated.description).toBe('Original desc');
    expect(updated.stage).toBe('INBOX');
  });
});
