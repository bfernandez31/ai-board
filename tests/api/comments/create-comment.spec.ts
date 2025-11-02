import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: POST /api/projects/[projectId]/tickets/[ticketId]/comments
 * Validates API contract from contracts/post-comment.yaml
 */

test.describe('POST /api/projects/[projectId]/tickets/[ticketId]/comments - Contract Validation', () => {
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

  test('should return 201 with created comment for valid request', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
      data: {
        content: 'This is a test comment',
      },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('ticketId', testTicketId);
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('content', 'This is a test comment');
    expect(body).toHaveProperty('createdAt');
    expect(body).toHaveProperty('updatedAt');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('name');
    expect(body.user).toHaveProperty('image');
  });

  test('should return 400 for empty content', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
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

  test('should return 400 for content exceeding 2000 characters', async ({ request , projectId }) => {
    const longContent = 'a'.repeat(2001);

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
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

  test('should return 400 for missing content field', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
    expect(body).toHaveProperty('issues');
  });

  test('should return 400 for whitespace-only content', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
      data: {
        content: '   ',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Validation failed');
  });

  test('should return 404 for non-existent ticket', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/999999/comments`, {
      data: {
        content: 'Comment on non-existent ticket',
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Ticket not found');
  });

  test('should trim whitespace from content', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicketId}/comments`, {
      data: {
        content: '  Test comment with whitespace  ',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.content).toBe('Test comment with whitespace');
  });
});
