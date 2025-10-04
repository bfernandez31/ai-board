import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Contract: PATCH /api/projects/:projectId/tickets/:id/branch', () => {
  let testProjectId: number;
  let testTicketId: number;

  test.beforeEach(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Contract Test Project',
        description: 'Project for contract testing',
        githubOwner: 'test-owner',
        githubRepo: 'contract-branch-test',
      },
    });
    testProjectId = project.id;

    // Create a test ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Test ticket for branch endpoint',
        description: 'Testing specialized branch endpoint',
        projectId: testProjectId,
      },
    });
    testTicketId = ticket.id;
  });

  test.afterEach(async () => {
    // Clean up test data
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should exist and update branch via specialized endpoint', async ({
    request,
  }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: '014-add-github-branch',
        },
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();

    // Verify minimal response (id, branch, updatedAt)
    expect(result).toHaveProperty('id', testTicketId);
    expect(result).toHaveProperty('branch', '014-add-github-branch');
    expect(result).toHaveProperty('updatedAt');

    // Should NOT include other fields (minimal response)
    expect(result).not.toHaveProperty('title');
    expect(result).not.toHaveProperty('description');
  });

  test('should accept branch as string', async ({ request }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: '123-feature-name',
        },
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.branch).toBe('123-feature-name');
  });

  test('should accept branch as null (clear branch)', async ({ request }) => {
    // First set a branch
    await prisma.ticket.update({
      where: { id: testTicketId },
      data: { branch: '014-to-be-cleared' },
    });

    // Then clear it via specialized endpoint
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: null,
        },
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.branch).toBeNull();
  });

  test('should reject branch longer than 200 characters', async ({
    request,
  }) => {
    const longBranch = 'a'.repeat(201);

    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: longBranch,
        },
      }
    );

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
    // Error should mention validation or max length
  });

  test('should require branch field in request body', async ({ request }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          // Missing branch field
        },
      }
    );

    // Should return 400 Bad Request (required field missing)
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should return 404 for non-existent ticket', async ({ request }) => {
    const nonExistentId = 999999;

    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${nonExistentId}/branch`,
      {
        data: {
          branch: '014-test',
        },
      }
    );

    expect(response.status()).toBe(404);
  });

  test('should persist branch update to database', async ({ request }) => {
    // Update via API
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: '014-persisted-branch',
        },
      }
    );

    // Query database directly to verify persistence
    const ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });

    expect(ticket).not.toBeNull();
    expect(ticket!.branch).toBe('014-persisted-branch');
  });

  test('should update updatedAt timestamp', async ({ request }) => {
    // Get initial ticket
    const beforeUpdate = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });

    // Wait a moment to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update branch
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}/branch`,
      {
        data: {
          branch: '014-timestamp-test',
        },
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    const updatedAt = new Date(result.updatedAt);
    const beforeUpdatedAt = new Date(beforeUpdate!.updatedAt);

    expect(updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
  });
});
