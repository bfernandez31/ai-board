import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: POST /api/projects/[projectId]/tickets/[ticketId]/comments
 * Validates API contract from contracts/post-comment.yaml
 */

test.describe('POST /api/projects/[projectId]/tickets/[ticketId]/comments - Contract Validation', () => {
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

  test('should return 201 with created comment for valid request', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {
        content: 'This is a test comment',
      },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('ticketId', 1);
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('content', 'This is a test comment');
    expect(body).toHaveProperty('createdAt');
    expect(body).toHaveProperty('updatedAt');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('name');
    expect(body.user).toHaveProperty('image');
  });

  test('should return 400 for empty content', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {
        content: '',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
    expect(body).toHaveProperty('issues');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  test('should return 400 for content exceeding 2000 characters', async ({ request }) => {
    const longContent = 'a'.repeat(2001);

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {
        content: longContent,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
    expect(body).toHaveProperty('issues');

    const contentIssue = body.issues.find((i: any) => i.path?.includes('content'));
    expect(contentIssue).toBeDefined();
    expect(contentIssue.message).toContain('2000');
  });

  test('should return 400 for missing content field', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
    expect(body).toHaveProperty('issues');
  });

  test('should return 400 for whitespace-only content', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {
        content: '   ',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
  });

  test('should return 404 for non-existent ticket', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/999999/comments`, {
      data: {
        content: 'Comment on non-existent ticket',
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Ticket not found');
  });

  test('should trim whitespace from content', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/1/comments`, {
      data: {
        content: '  Test comment with whitespace  ',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.content).toBe('Test comment with whitespace');
  });
});
