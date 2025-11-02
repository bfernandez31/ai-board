import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: GET /api/projects/[projectId]/tickets/[ticketId]/comments
 * Validates API contract from contracts/get-comments.yaml
 */

test.describe('GET /api/projects/[projectId]/tickets/[ticketId]/comments - Contract Validation', () => {
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

  test('should return 200 with empty array for ticket with no comments', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('comments');
    expect(body).toHaveProperty('mentionedUsers');
    expect(body).toHaveProperty('currentUserId');
    expect(Array.isArray(body.comments)).toBe(true);
    expect(body.comments.length).toBe(0);
  });

  test('should return 200 with array of comments in reverse chronological order', async ({ request , projectId }) => {
    // Create 3 comments with different timestamps
    await prisma.comment.createMany({
      data: [
        {
          ticketId: testTicketId,
          userId: 'test-user-id',
          content: 'First comment',
          createdAt: new Date('2025-01-22T10:00:00Z'),
        },
        {
          ticketId: testTicketId,
          userId: 'test-user-id',
          content: 'Second comment',
          createdAt: new Date('2025-01-22T11:00:00Z'),
        },
        {
          ticketId: testTicketId,
          userId: 'test-user-id',
          content: 'Third comment',
          createdAt: new Date('2025-01-22T12:00:00Z'),
        },
      ],
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.comments.length).toBe(3);
    // Newest first (reverse chronological)
    expect(body.comments[0].content).toBe('Third comment');
    expect(body.comments[1].content).toBe('Second comment');
    expect(body.comments[2].content).toBe('First comment');
  });

  test('should include user data (name, image) in response', async ({ request , projectId }) => {
    await prisma.comment.create({
      data: {
        ticketId: testTicketId,
        userId: 'test-user-id',
        content: 'Test comment',
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.comments.length).toBe(1);
    expect(body.comments[0]).toHaveProperty('user');
    expect(body.comments[0].user).toHaveProperty('name');
    expect(body.comments[0].user).toHaveProperty('image');
    expect(body.comments[0].user.name).toBe('E2E Test User');
  });

  test('should return 400 for invalid project ID', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/abc/tickets/1/comments`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid ticket ID', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/abc/comments`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 404 for non-existent ticket', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/projects/${projectId}/tickets/999999/comments`);

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Ticket not found');
  });
});
