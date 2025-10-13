import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Test: Branch validation edge cases (Scenarios 5-7)
 *
 * Tests validation and edge cases for branch and autoMode:
 * - Clear branch (set to null)
 * - Reject branch longer than 200 characters (400 error)
 * - Reject invalid autoMode type (400 error)
 * - Proper error messages
 *
 * This ensures validation works correctly at API and database layers.
 */
test.describe('Integration: Branch validation edge cases', () => {
  let testProjectId: number;

  test.beforeAll(async () => {
    // REQUIRED pattern: Create test user before any project operations
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
      },
    });

    // Create a test project with [e2e] prefix for automatic cleanup
    const project = await prisma.project.create({
      data: {
        name: '[e2e] Validation Test Project',
        description: 'Project for testing validation edge cases',
        githubOwner: 'integration-test-owner',
        githubRepo: 'validation-test',
        userId: testUser.id,
      },
    });
    testProjectId = project.id;
  });

  test.afterAll(async () => {
    // Clean up all test data
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
    await prisma.$disconnect();
  });

  test('should clear branch by setting to null', async ({ request }) => {
    // Create ticket with branch
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Ticket with branch to clear',
          description: 'Branch will be cleared',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set branch
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: { branch: '014-to-be-cleared', version: 1 },
    });

    // Verify branch is set
    let fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBe('014-to-be-cleared');

    // Clear branch via general PATCH endpoint
    const clearResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { branch: null, version: 2 },
      }
    );

    expect(clearResponse.status()).toBe(200);

    const clearedTicket = await clearResponse.json();
    expect(clearedTicket.branch).toBeNull();

    // Verify persistence
    fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBeNull();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should clear branch via /branch endpoint', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Ticket for branch endpoint clear',
          description: 'Branch will be cleared via specialized endpoint',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set branch via specialized endpoint
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '014-to-clear' },
      }
    );

    // Clear branch via specialized endpoint
    const clearResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: null },
      }
    );

    expect(clearResponse.status()).toBe(200);

    const result = await clearResponse.json();
    expect(result.branch).toBeNull();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should reject branch longer than 200 characters via PATCH', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Max length test',
          description: 'Testing branch max length validation',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt to set branch longer than 200 characters
    const longBranch = 'a'.repeat(201);

    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { branch: longBranch, version: 1 },
      }
    );

    // Should return 400 Bad Request
    expect(updateResponse.status()).toBe(400);

    const error = await updateResponse.json();
    expect(error).toHaveProperty('error');

    // Verify branch was NOT updated
    const fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.branch).toBeNull();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should reject branch longer than 200 characters via /branch endpoint', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Branch endpoint max length test',
          description: 'Testing specialized endpoint validation',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt to set branch longer than 200 characters
    const longBranch = 'b'.repeat(201);

    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: longBranch },
      }
    );

    // Should return 400 Bad Request
    expect(updateResponse.status()).toBe(400);

    const error = await updateResponse.json();
    expect(error).toHaveProperty('error');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should accept branch exactly 200 characters (boundary test)', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Boundary test',
          description: 'Testing exact 200 character limit',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Create branch name exactly 200 characters
    const exactlyMaxBranch = 'a'.repeat(200);

    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { branch: exactlyMaxBranch, version: 1 },
      }
    );

    // Should succeed
    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();
    expect(updatedTicket.branch).toBe(exactlyMaxBranch);
    expect(updatedTicket.branch.length).toBe(200);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should reject invalid autoMode type (string)', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] AutoMode type validation',
          description: 'Testing autoMode type checking',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt to set autoMode to string "true" instead of boolean true
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: 'yes' as any, version: 1 },
      }
    );

    // Should return 400 Bad Request
    expect(updateResponse.status()).toBe(400);

    const error = await updateResponse.json();
    expect(error).toHaveProperty('error');

    // Verify autoMode was NOT updated
    const fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();
    expect(fetchedTicket.autoMode).toBe(false);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should reject invalid autoMode type (number)', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] AutoMode number type test',
          description: 'Testing autoMode with number',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt to set autoMode to number 1 instead of boolean true
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: 1 as any, version: 1 },
      }
    );

    // Should return 400 Bad Request
    expect(updateResponse.status()).toBe(400);

    const error = await updateResponse.json();
    expect(error).toHaveProperty('error');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should reject invalid autoMode type (null)', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] AutoMode null test',
          description: 'Testing autoMode with null',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt to set autoMode to null (should be boolean, not nullable)
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: null as any, version: 1 },
      }
    );

    // Should return 400 Bad Request
    expect(updateResponse.status()).toBe(400);

    const error = await updateResponse.json();
    expect(error).toHaveProperty('error');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should provide clear error message for validation failures', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Error message test',
          description: 'Testing error messages',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Test branch too long
    const longBranchResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { branch: 'a'.repeat(201), version: 1 },
      }
    );

    expect(longBranchResponse.status()).toBe(400);

    const branchError = await longBranchResponse.json();
    expect(branchError.error).toBeTruthy();
    // Error message should indicate the problem

    // Test invalid autoMode type
    const invalidAutoModeResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { autoMode: 'invalid' as any, version: 1 },
      }
    );

    expect(invalidAutoModeResponse.status()).toBe(400);

    const autoModeError = await invalidAutoModeResponse.json();
    expect(autoModeError.error).toBeTruthy();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle empty string branch (different from null)', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Empty string test',
          description: 'Testing empty string vs null',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set branch to empty string (should be allowed)
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: { branch: '', version: 1 },
      }
    );

    // Empty string should be allowed (different semantic from null)
    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();
    expect(updatedTicket.branch).toBe('');
    expect(updatedTicket.branch).not.toBeNull();

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });
});
