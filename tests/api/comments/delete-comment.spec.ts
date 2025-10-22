import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
 * Validates API contract from contracts/delete-comment.yaml
 */

test.describe('DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId] - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async () => {
    await cleanupDatabase();

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
    await prisma.ticket.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        title: '[e2e] Test Ticket',
        description: 'Test ticket for comments',
        projectId: 1,
        updatedAt: new Date(),
      },
    });
  });

  test('should return 204 for successful deletion by author', async ({ request }) => {
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ticketId: 1,
        userId: 'test-user-id',
        content: 'Comment to be deleted',
      },
    });

    const response = await request.delete(
      `${BASE_URL}/api/projects/1/tickets/1/comments/${comment.id}`
    );

    expect(response.status()).toBe(204);
    expect(response.body()).resolves.toHaveLength(0);

    // Verify comment is actually deleted from database
    const deletedComment = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(deletedComment).toBeNull();
  });

  test('should return 403 for user trying to delete another user comment', async ({ request }) => {
    // Create another user
    await prisma.user.create({
      data: {
        id: 'other-user-id',
        email: 'other@e2e.local',
        name: 'Other User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create comment by other user
    const comment = await prisma.comment.create({
      data: {
        ticketId: 1,
        userId: 'other-user-id',
        content: 'Comment by other user',
      },
    });

    // Test user (owner of project) tries to delete other user's comment
    const response = await request.delete(
      `${BASE_URL}/api/projects/1/tickets/1/comments/${comment.id}`
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('You can only delete your own comments');

    // Verify comment still exists
    const stillExists = await prisma.comment.findUnique({
      where: { id: comment.id },
    });
    expect(stillExists).not.toBeNull();
  });

  test('should return 403 for user who does not own the project', async ({ request }) => {
    // Create another user and project
    await prisma.user.create({
      data: {
        id: 'other-user-id',
        email: 'other@e2e.local',
        name: 'Other User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.project.create({
      data: {
        id: 99,
        name: '[e2e] Other Project',
        description: 'Another project',
        githubOwner: 'other',
        githubRepo: 'repo',
        userId: 'other-user-id',
        updatedAt: new Date(),
      },
    });

    await prisma.ticket.create({
      data: {
        id: 99,
        title: '[e2e] Other Ticket',
        description: 'Ticket in other project',
        projectId: 99,
        updatedAt: new Date(),
      },
    });

    const comment = await prisma.comment.create({
      data: {
        ticketId: 99,
        userId: 'other-user-id',
        content: 'Comment in other project',
      },
    });

    const response = await request.delete(
      `${BASE_URL}/api/projects/99/tickets/99/comments/${comment.id}`
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('Forbidden');
  });

  test('should return 404 for non-existent comment', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/projects/1/tickets/1/comments/999999`);

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Comment not found');
  });

  test('should return 404 for comment belonging to different ticket', async ({ request }) => {
    // Create another ticket
    await prisma.ticket.create({
      data: {
        id: 2,
        title: '[e2e] Another Ticket',
        description: 'Another test ticket',
        projectId: 1,
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
      `${BASE_URL}/api/projects/1/tickets/1/comments/${comment.id}`
    );

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Comment not found');
  });

  test('should return 400 for invalid comment ID', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/projects/1/tickets/1/comments/abc`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
