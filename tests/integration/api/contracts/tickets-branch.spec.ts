import { test, expect } from '../../../helpers/worker-isolation';
import { cleanupDatabase } from '../../../helpers/db-cleanup';
import { getWorkflowHeaders } from '../../../helpers/workflow-auth';

test.describe('Contract: PATCH /api/projects/:projectId/tickets/:id/branch', () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean database before each test (worker-specific isolation)
    await cleanupDatabase(projectId);
  });

  test('should exist and update branch via specialized endpoint', async ({ request, projectId }) => {
    // Create ticket
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: {
        title: '[e2e] Test ticket for branch endpoint',
        description: 'Testing specialized branch endpoint',
      },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: {
          branch: '014-add-github-branch',
        },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();

    // Verify response structure
    expect(result).toHaveProperty('id', ticket.id);
    expect(result).toHaveProperty('branch', '014-add-github-branch');
    expect(result).toHaveProperty('updatedAt');
    expect(result.updatedAt).not.toBe(ticket.updatedAt);
  });

  test('should accept branch as string', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: { branch: '123-test-branch' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.branch).toBe('123-test-branch');
    expect(typeof result.branch).toBe('string');
  });

  test('should accept branch as null (clear branch)', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    // Set branch first
    await request.patch(`/api/projects/${projectId}/tickets/${ticket.id}/branch`, {
      data: { branch: '001-initial' },
      headers: getWorkflowHeaders(),
    });

    // Clear branch
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: { branch: null },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.branch).toBeNull();
  });

  test('should reject branch longer than 200 characters', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: { branch: 'a'.repeat(201) },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should require branch field in request body', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: {},
        headers: getWorkflowHeaders(),
      }
    );

    // Should return 400 Bad Request (required field missing)
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should return 404 for non-existent ticket', async ({ request, projectId }) => {
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/999999/branch`,
      {
        data: { branch: '001-test' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should persist branch update to database', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();

    await request.patch(`/api/projects/${projectId}/tickets/${ticket.id}/branch`, {
      data: { branch: '014-persistence-test' },
      headers: getWorkflowHeaders(),
    });

    // Verify persistence via GET
    const getResp = await request.get(`/api/projects/${projectId}/tickets/${ticket.id}`);
    const fetchedTicket = await getResp.json();
    expect(fetchedTicket.branch).toBe('014-persistence-test');
  });

  test('should update updatedAt timestamp', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test', description: 'Test' },
    });
    const ticket = await createResp.json();
    const originalUpdatedAt = ticket.updatedAt;

    // Wait to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.id}/branch`,
      {
        data: { branch: '014-timestamp-test' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    const updatedAt = new Date(result.updatedAt);
    const originalDate = new Date(originalUpdatedAt);
    expect(updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
  });

  test('should accept ticketKey instead of numeric ID in GET request', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test ticket for ticketKey', description: 'Test' },
    });
    const ticket = await createResp.json();

    // Update branch using numeric ID
    await request.patch(`/api/projects/${projectId}/tickets/${ticket.id}/branch`, {
      data: { branch: '001-test-branch' },
      headers: getWorkflowHeaders(),
    });

    // Fetch using ticketKey instead of numeric ID
    const response = await request.get(
      `/api/projects/${projectId}/tickets/${ticket.ticketKey}/branch`
    );

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.id).toBe(ticket.id);
    expect(result.branch).toBe('001-test-branch');
  });

  test('should accept ticketKey instead of numeric ID in PATCH request', async ({ request, projectId }) => {
    const createResp = await request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Test ticket for ticketKey PATCH', description: 'Test' },
    });
    const ticket = await createResp.json();

    // Update branch using ticketKey instead of numeric ID
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/${ticket.ticketKey}/branch`,
      {
        data: { branch: '002-ticketkey-patch' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.id).toBe(ticket.id);
    expect(result.branch).toBe('002-ticketkey-patch');
  });

  test('should return 400 for invalid ticketKey format in GET', async ({ request, projectId }) => {
    const response = await request.get(
      `/api/projects/${projectId}/tickets/INVALID-KEY-FORMAT/branch`
    );

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.message).toContain('Ticket identifier must be a number or ticket key');
  });

  test('should return 400 for invalid ticketKey format in PATCH', async ({ request, projectId }) => {
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/INVALID-KEY-FORMAT/branch`,
      {
        data: { branch: '001-test' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.message).toContain('Ticket identifier must be a number or ticket key');
  });

  test('should return 404 for non-existent ticketKey', async ({ request, projectId }) => {
    const response = await request.patch(
      `/api/projects/${projectId}/tickets/XYZ-99999/branch`,
      {
        data: { branch: '001-test' },
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(404);
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });
});
