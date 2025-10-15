import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getWorkflowHeaders } from '../../../helpers/workflow-auth';

const prisma = new PrismaClient();

test.describe('Contract: PATCH /api/projects/:projectId/tickets/:id/branch', () => {
  let testProjectId: number;
  let testTicketId: number;

  test.beforeEach(async () => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Create a test project with [e2e] prefix for automatic cleanup
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Contract Test Project',
        description: 'Project for contract testing',
        githubOwner: 'test-owner',
        githubRepo: 'contract-branch-test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });
    testProjectId = project.id;

    // Create a test ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket for branch endpoint',
        description: 'Testing specialized branch endpoint',
        projectId: testProjectId,
        updatedAt: new Date(), // Required field
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
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
        headers: getWorkflowHeaders(),
      }
    );

    expect(response.status()).toBe(200);

    const result = await response.json();
    const updatedAt = new Date(result.updatedAt);
    const beforeUpdatedAt = new Date(beforeUpdate!.updatedAt);

    expect(updatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
  });
});
