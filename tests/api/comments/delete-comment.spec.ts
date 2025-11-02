import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
 * Validates API contract from contracts/delete-comment.yaml
 */

test.describe('DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId] - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';
  let testTicketId: number;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);

    // Create test user
    await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create test ticket
    const testTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket for comments',
        projectId,
        updatedAt: new Date(),
      },
    });
    testTicketId = testTicket.id;
  });

  test('should return 204 for successful deletion by author', async ({ request , projectId }) => {
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: 'test-user-id',
        content: 'Comment to be deleted',
      },
    });

    const response = await request.delete(
      `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/${comment.id}`
    );

    expect(response.status()).toBe(204);
    expect(response.body()).resolves.toHaveLength(0);

    // Verify comment is actually deleted from database
    const deletedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(deletedComment).toBeNull();
  });

  test('should return 404 for non-existent comment', async ({ request , projectId }) => {
    const response = await request.delete(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/999999`);

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Comment not found');
  });

  test('should return 404 for comment belonging to different ticket', async ({ request , projectId }) => {
    // Create another ticket
    await prisma.ticket.create({
      data: {
        id: 2,
        ticketNumber: 2,
        ticketKey: `E2E${projectId}-2`,
        title: '[e2e] Another Ticket',
        description: 'Another test ticket',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create comment on ticket 2
    const comment = await prisma.comment.create({
      data: {
        ticketId: 2,
        userId: 'test-user-id',
        content: 'Comment on ticket 2',
      },
    });

    // Try to delete comment via ticket 1 endpoint
    const response = await request.delete(
      `${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/${comment.id}`
    );

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Comment not found');
  });

  test('should return 400 for invalid comment ID', async ({ request , projectId }) => {
    const response = await request.delete(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments/abc`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
