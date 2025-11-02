import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase } from '../../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * API Test: AI-BOARD Mention Detection
 * Validates that @ai-board mentions are detected and trigger workflow dispatch
 */

test.describe('POST /api/projects/[projectId]/tickets/[id]/comments - AI-BOARD Mention Detection', () => {
  const BASE_URL = 'http://localhost:3000';
  let aiBoardUserId: string;
  let testTicket: { id: number };

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

    // Create AI-BOARD user
    const aiBoardUser = await prisma.user.upsert({
      where: { email: 'ai-board@system.local' },
      update: {},
      create: {
        id: 'ai-board-system-user',
        email: 'ai-board@system.local',
        name: 'AI-BOARD Assistant',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    aiBoardUserId = aiBoardUser.id;

    // Add AI-BOARD as project member
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: aiBoardUserId,
        },
      },
      update: {},
      create: {
        projectId,
        userId: aiBoardUserId,
        role: 'member',
      },
    });

    // Create test ticket in SPECIFY stage (valid for AI-BOARD)
    testTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `E2E${projectId}-1`,
        title: '[e2e] Test Ticket',
        description: 'Test ticket for AI-BOARD mentions',
        stage: 'SPECIFY',
        branch: '001-test-ticket', // Required for AI-BOARD workflow dispatch
        projectId,
        updatedAt: new Date(),
      },
    });
  });

  test('should create Job when @ai-board is mentioned in valid stage', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `Hey @[${aiBoardUserId}:AI-BOARD Assistant] can you update the spec?`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('jobId');

    // Verify Job was created
    const job = await prisma.job.findUnique({
      where: { id: body.jobId },
    });

    expect(job).not.toBeNull();
    expect(job?.ticketId).toBe(testTicket.id);
    expect(job?.command).toBe('comment-specify');
    expect(job?.status).toBe('PENDING');
  });

  test('should return 400 when @ai-board mentioned in INBOX stage', async ({ request , projectId }) => {
    // Change ticket to INBOX stage
    await prisma.ticket.update({
      where: { id: testTicket.id },
      data: { stage: 'INBOX' },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `Hey @[${aiBoardUserId}:AI-BOARD Assistant] can you help?`,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('AI_BOARD_UNAVAILABLE');
    expect(body.error).toContain('not available');
    expect(body.error).toContain('INBOX');
  });

  test('should return 400 when @ai-board mentioned while job is RUNNING', async ({ request , projectId }) => {
    // Create RUNNING job
    await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        projectId,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `Hey @[${aiBoardUserId}:AI-BOARD Assistant] can you help?`,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('AI_BOARD_UNAVAILABLE');
    expect(body.error).toContain('already processing');
  });

  test('should create comment normally when AI-BOARD not mentioned', async ({ request , projectId }) => {
    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: 'Regular comment without mentions',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).not.toHaveProperty('jobId');
    expect(body.content).toBe('Regular comment without mentions');
  });

  test('should create Job for PLAN stage mention', async ({ request , projectId }) => {
    // Change ticket to PLAN stage
    await prisma.ticket.update({
      where: { id: testTicket.id },
      data: { stage: 'PLAN' },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `@[${aiBoardUserId}:AI-BOARD Assistant] update the plan please`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('jobId');

    const job = await prisma.job.findUnique({
      where: { id: body.jobId },
    });

    expect(job?.command).toBe('comment-plan');
  });

  test('should create Job for BUILD stage mention', async ({ request , projectId }) => {
    // Change ticket to BUILD stage
    await prisma.ticket.update({
      where: { id: testTicket.id },
      data: { stage: 'BUILD' },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `@[${aiBoardUserId}:AI-BOARD Assistant] help with implementation`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('jobId');

    const job = await prisma.job.findUnique({
      where: { id: body.jobId },
    });

    expect(job?.command).toBe('comment-build');
  });

  test('should create Job for VERIFY stage mention', async ({ request , projectId }) => {
    // Change ticket to VERIFY stage
    await prisma.ticket.update({
      where: { id: testTicket.id },
      data: { stage: 'VERIFY' },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `@[${aiBoardUserId}:AI-BOARD Assistant] help verify this`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('jobId');

    const job = await prisma.job.findUnique({
      where: { id: body.jobId },
    });

    expect(job?.command).toBe('comment-verify');
  });

  test('should handle mention with other users in same comment', async ({ request , projectId }) => {
    // Create another test user
    const otherUser = await prisma.user.create({
      data: {
        id: 'other-user',
        email: 'other@test.com',
        name: 'Other User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId,
        userId: otherUser.id,
        role: 'member',
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/${projectId}/tickets/${testTicket.id}/comments`, {
      data: {
        content: `Hey @[${otherUser.id}:Other User] and @[${aiBoardUserId}:AI-BOARD Assistant], check this`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('jobId');
  });
});
