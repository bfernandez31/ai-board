import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * API Test: GET /api/tickets/[id]/ai-board-availability
 * Validates AI-BOARD availability checking based on ticket stage and job status
 */

test.describe('GET /api/tickets/[id]/ai-board-availability - AI-BOARD Availability', () => {
  const BASE_URL = 'http://localhost:3000';

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
  });

  test('should return available=false for INBOX stage', async ({ request , projectId }) => {
    // Create ticket in INBOX stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(false);
    expect(body.reason).toContain('INBOX');
  });

  test('should return available=true for SPECIFY stage with no running jobs', async ({ request , projectId }) => {
    // Create ticket in SPECIFY stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(true);
    expect(body.reason).toBeUndefined();
  });

  test('should return available=true for PLAN stage with no running jobs', async ({ request , projectId }) => {
    // Create ticket in PLAN stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'PLAN',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(true);
  });

  test('should return available=true for BUILD stage with no running jobs', async ({ request , projectId }) => {
    // Create ticket in BUILD stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'BUILD',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(true);
  });

  test('should return available=true for VERIFY stage with no running jobs', async ({ request , projectId }) => {
    // Create ticket in VERIFY stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'VERIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(true);
  });

  test('should return available=false for SHIP stage', async ({ request , projectId }) => {
    // Create ticket in SHIP stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'SHIP',
        projectId,
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(false);
    expect(body.reason).toContain('SHIP');
  });

  test('should return available=false when job is PENDING', async ({ request , projectId }) => {
    // Create ticket in SPECIFY stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create PENDING job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'PENDING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(false);
    expect(body.reason).toContain('already processing');
    expect(body.reason).toContain('PENDING');
  });

  test('should return available=false when job is RUNNING', async ({ request , projectId }) => {
    // Create ticket in SPECIFY stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create RUNNING job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(false);
    expect(body.reason).toContain('already processing');
    expect(body.reason).toContain('RUNNING');
  });

  test('should return available=true when job is COMPLETED', async ({ request , projectId }) => {
    // Create ticket in SPECIFY stage
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket',
        stage: 'SPECIFY',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Create COMPLETED job
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'comment-specify',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.get(`${BASE_URL}/api/tickets/${ticket.id}/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(true);
    expect(body.reason).toBeUndefined();
  });

  test('should return 404 for non-existent ticket', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/tickets/999999/ai-board-availability`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.available).toBe(false);
    expect(body.reason).toBe('Ticket not found');
  });

  test('should return 400 for invalid ticket ID', async ({ request , projectId }) => {
    const response = await request.get(`${BASE_URL}/api/tickets/invalid/ai-board-availability`);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid ticket ID');
  });
});
