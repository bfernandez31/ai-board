import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Contract: POST /api/projects/:projectId/tickets', () => {
  let testProjectId: number;

  test.beforeAll(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Contract Test Project',
        description: 'Project for contract testing',
        githubOwner: 'test-owner',
        githubRepo: 'contract-test-repo',
      },
    });
    testProjectId = project.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
    await prisma.$disconnect();
  });

  test('should return branch=null and autoMode=false for new ticket', async ({
    request,
  }) => {
    // Create a new ticket
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Test ticket for branch tracking',
          description: 'This ticket tests the default values for branch and autoMode',
        },
      }
    );

    expect(response.status()).toBe(201);

    const ticket = await response.json();

    // Verify response structure
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('title', 'Test ticket for branch tracking');
    expect(ticket).toHaveProperty('description');
    expect(ticket).toHaveProperty('stage', 'INBOX');
    expect(ticket).toHaveProperty('version', 1);
    expect(ticket).toHaveProperty('projectId', testProjectId);
    expect(ticket).toHaveProperty('createdAt');
    expect(ticket).toHaveProperty('updatedAt');

    // CRITICAL: Verify new fields with default values
    expect(ticket).toHaveProperty('branch');
    expect(ticket.branch).toBeNull(); // Must be null, not undefined or empty string

    expect(ticket).toHaveProperty('autoMode');
    expect(ticket.autoMode).toBe(false); // Must be false (boolean)

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should not accept branch or autoMode in creation request', async ({
    request,
  }) => {
    // Attempt to create ticket with branch and autoMode (should be ignored or rejected)
    const response = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: 'Test ticket',
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

    // Clean up
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
