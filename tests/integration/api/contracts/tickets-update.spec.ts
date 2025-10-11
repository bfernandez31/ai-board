import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Contract: PATCH /api/projects/:projectId/tickets/:id', () => {
  let testProjectId: number;
  let testTicketId: number;

  test.beforeEach(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Contract Test Project',
        description: 'Project for contract testing',
        githubOwner: 'test-owner',
        githubRepo: 'contract-update-test',
      },
    });
    testProjectId = project.id;

    // Create a test ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test ticket',
        description: 'Test description',
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

  test('should accept and update branch field (string)', async ({
    request,
  }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          branch: '014-add-github-branch',
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const ticket = await response.json();
    expect(ticket.branch).toBe('014-add-github-branch');
  });

  test('should accept and update branch field (null)', async ({ request }) => {
    // First set a branch
    await prisma.ticket.update({
      where: { id: testTicketId },
      data: { branch: '014-test-branch' },
    });

    // Then clear it (set to null)
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          branch: null,
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const ticket = await response.json();
    expect(ticket.branch).toBeNull();
  });

  test('should accept and update autoMode field', async ({ request }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const ticket = await response.json();
    expect(ticket.autoMode).toBe(true);
  });

  test('should validate branch max length (200 characters)', async ({
    request,
  }) => {
    // Create a branch name longer than 200 characters
    const longBranch = 'a'.repeat(201);

    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          branch: longBranch,
          version: 1,
        },
      }
    );

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should update multiple fields including branch and autoMode', async ({
    request,
  }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          title: '[e2e] Updated title',
          branch: '014-updated-feature',
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const ticket = await response.json();
    expect(ticket.title).toBe('[e2e] Updated title');
    expect(ticket.branch).toBe('014-updated-feature');
    expect(ticket.autoMode).toBe(true);
  });

  test('should preserve other fields when updating branch', async ({
    request,
  }) => {
    const response = await request.patch(
      `/api/projects/${testProjectId}/tickets/${testTicketId}`,
      {
        data: {
          branch: '014-new-branch',
          version: 1,
        },
      }
    );

    expect(response.status()).toBe(200);

    const ticket = await response.json();
    expect(ticket.branch).toBe('014-new-branch');
    expect(ticket.title).toBe('[e2e] Test ticket'); // Unchanged
    expect(ticket.description).toBe('Test description'); // Unchanged
  });
});
