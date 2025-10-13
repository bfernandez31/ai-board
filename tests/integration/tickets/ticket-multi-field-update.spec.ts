import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Test: Multiple fields atomic update (Scenario 4)
 *
 * Tests that multiple fields including branch and autoMode can be updated
 * atomically in a single PATCH request:
 * - All specified fields should update
 * - Unchanged fields should be preserved
 * - Single database transaction
 *
 * This verifies the general PATCH endpoint handles new fields correctly.
 */
test.describe('Integration: Multiple fields atomic update', () => {
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
        name: '[e2e] Multi-Field Update Test Project',
        description: 'Project for testing atomic multi-field updates',
        githubOwner: 'integration-test-owner',
        githubRepo: 'multi-field-test',
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

  test('should update title and branch atomically (without stage change)', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Original Title',
          description: 'Original Description',
        },
      }
    );

    expect(createResponse.status()).toBe(201);

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Verify initial state
    expect(ticket.title).toBe('[e2e] Original Title');
    expect(ticket.stage).toBe('INBOX');
    expect(ticket.branch).toBeNull();
    expect(ticket.autoMode).toBe(false);

    // Update title and branch (without changing stage)
    // Note: When stage changes, the workflow generates the branch name automatically,
    // so we can't manually set both stage and branch in the same request
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] Updated: GitHub Integration',
          branch: '014-github-integration-updated',
          version: 1,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();

    // Verify specified fields updated
    expect(updatedTicket.title).toBe('[e2e] Updated: GitHub Integration');
    expect(updatedTicket.branch).toBe('014-github-integration-updated');
    expect(updatedTicket.stage).toBe('INBOX'); // Stage unchanged

    // Verify unchanged fields preserved
    expect(updatedTicket.description).toBe('Original Description');
    expect(updatedTicket.autoMode).toBe(false);

    // Verify in database
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    expect(dbTicket!.title).toBe('[e2e] Updated: GitHub Integration');
    expect(dbTicket!.stage).toBe('INBOX');
    expect(dbTicket!.branch).toBe('014-github-integration-updated');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should update branch and autoMode together', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Test both new fields',
          description: 'Update branch and autoMode together',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Update both new fields atomically
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          branch: '014-new-feature',
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();

    // Verify both fields updated
    expect(updatedTicket.branch).toBe('014-new-feature');
    expect(updatedTicket.autoMode).toBe(true);

    // Verify other fields unchanged
    expect(updatedTicket.title).toBe('[e2e] Test both new fields');
    expect(updatedTicket.description).toBe('Update branch and autoMode together');
    expect(updatedTicket.stage).toBe('INBOX');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should preserve unchanged fields in multi-field update', async ({
    request,
  }) => {
    // Create ticket with all fields set
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Full ticket',
          description: 'With all fields',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set branch first
    await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}/branch`,
      {
        data: { branch: '001-initial-branch' },
      }
    );

    // Update only title and autoMode (branch should remain)
    // Note: /branch endpoint doesn't increment version, so version is still 1
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] New title',
          autoMode: true,
          version: 1, // Version is still 1 because /branch doesn't increment it
        },
      }
    );

    const updatedTicket = await updateResponse.json();

    // Verify updated fields
    expect(updatedTicket.title).toBe('[e2e] New title');
    expect(updatedTicket.autoMode).toBe(true);

    // Verify unchanged fields
    expect(updatedTicket.branch).toBe('001-initial-branch'); // Should remain
    expect(updatedTicket.description).toBe('With all fields'); // Should remain

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle updating all mutable fields at once (except stage)', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Comprehensive update test',
          description: 'All fields will be updated',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Update all mutable fields in one request (except stage, because stage
    // transitions trigger workflows that generate their own branch names)
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] New Title',
          description: 'New Description',
          branch: '014-comprehensive-update',
          autoMode: true,
          version: 1,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();

    // Verify all updated fields
    expect(updatedTicket.title).toBe('[e2e] New Title');
    expect(updatedTicket.description).toBe('New Description');
    expect(updatedTicket.branch).toBe('014-comprehensive-update');
    expect(updatedTicket.autoMode).toBe(true);

    // Verify stage unchanged (we didn't update it)
    expect(updatedTicket.stage).toBe('INBOX');

    // Verify immutable fields unchanged
    expect(updatedTicket.id).toBe(ticketId);
    expect(updatedTicket.projectId).toBe(testProjectId);
    expect(updatedTicket.createdAt).toBe(ticket.createdAt);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle partial updates without affecting unspecified fields', async ({
    request,
  }) => {
    // Create and setup ticket with all fields
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Partial update test',
          description: 'Testing selective updates',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set initial branch and autoMode
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: {
        branch: '001-initial',
        autoMode: true,
        version: 1,
      },
    });

    // Partial update: only change title
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] Only title changed',
          version: 2,
        },
      }
    );

    const updatedTicket = await updateResponse.json();

    // Verify only title changed
    expect(updatedTicket.title).toBe('[e2e] Only title changed');

    // Verify all other fields unchanged
    expect(updatedTicket.description).toBe('Testing selective updates');
    expect(updatedTicket.stage).toBe('INBOX');
    expect(updatedTicket.branch).toBe('001-initial');
    expect(updatedTicket.autoMode).toBe(true);

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should handle clearing branch while updating other fields', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Branch clear test',
          description: 'Branch will be cleared',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Set branch first
    await request.patch(`/api/projects/${testProjectId}/tickets/${ticketId}`, {
      data: { branch: '001-to-be-cleared', version: 1 },
    });

    // Clear branch and update title in same request
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] Branch cleared',
          branch: null,
          version: 2,
        },
      }
    );

    expect(updateResponse.status()).toBe(200);

    const updatedTicket = await updateResponse.json();

    // Verify branch cleared
    expect(updatedTicket.branch).toBeNull();

    // Verify title updated
    expect(updatedTicket.title).toBe('[e2e] Branch cleared');

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  test('should maintain atomicity: all fields update or none', async ({
    request,
  }) => {
    // Create ticket
    const createResponse = await request.post(
      `/api/projects/${testProjectId}/tickets`,
      {
        data: {
          title: '[e2e] Atomicity test',
          description: 'Testing transaction atomicity',
        },
      }
    );

    const ticket = await createResponse.json();
    const ticketId = ticket.id;

    // Attempt update with invalid data (branch too long)
    const updateResponse = await request.patch(
      `/api/projects/${testProjectId}/tickets/${ticketId}`,
      {
        data: {
          title: '[e2e] Should not update',
          branch: 'a'.repeat(201), // Too long, will fail
          autoMode: true,
          version: 1,
        },
      }
    );

    // Should fail
    expect(updateResponse.status()).toBe(400);

    // Verify NO fields updated (atomicity)
    const fetchedTicket = await (
      await request.get(`/api/projects/${testProjectId}/tickets/${ticketId}`)
    ).json();

    expect(fetchedTicket.title).toBe('[e2e] Atomicity test'); // Unchanged
    expect(fetchedTicket.branch).toBeNull(); // Unchanged
    expect(fetchedTicket.autoMode).toBe(false); // Unchanged

    // Clean up
    await prisma.ticket.delete({ where: { id: ticketId } });
  });
});
