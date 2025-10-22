import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: GET /api/projects/[projectId]/tickets/[ticketId]/comments
 * Validates API contract from contracts/get-comments.yaml
 */

test.describe('GET /api/projects/[projectId]/tickets/[ticketId]/comments - Contract Validation', () => {
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

  test('should return 200 with empty array for ticket with no comments', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/1/comments`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test('should return 200 with array of comments in reverse chronological order', async ({ request }) => {
    // Create 3 comments with different timestamps
    await prisma.comment.createMany({
      data: [
        {
          ticketId: 1,
          userId: 'test-user-id',
          content: 'First comment',
          createdAt: new Date('2025-01-22T10:00:00Z'),
        },
        {
          ticketId: 1,
          userId: 'test-user-id',
          content: 'Second comment',
          createdAt: new Date('2025-01-22T11:00:00Z'),
        },
        {
          ticketId: 1,
          userId: 'test-user-id',
          content: 'Third comment',
          createdAt: new Date('2025-01-22T12:00:00Z'),
        },
      ],
    });

    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/1/comments`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.length).toBe(3);
    // Newest first (reverse chronological)
    expect(body[0].content).toBe('Third comment');
    expect(body[1].content).toBe('Second comment');
    expect(body[2].content).toBe('First comment');
  });

  test('should include user data (name, image) in response', async ({ request }) => {
    await prisma.comment.create({
      data: {
        ticketId: 1,
        userId: 'test-user-id',
        content: 'Test comment',
      },
    });

    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/1/comments`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.length).toBe(1);
    expect(body[0]).toHaveProperty('user');
    expect(body[0].user).toHaveProperty('name');
    expect(body[0].user).toHaveProperty('image');
    expect(body[0].user.name).toBe('E2E Test User');
  });

  test('should return 400 for invalid project ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/abc/tickets/1/comments`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid ticket ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/abc/comments`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 404 for non-existent ticket', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/projects/1/tickets/999999/comments`);

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Ticket not found');
  });
});
