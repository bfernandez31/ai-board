import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { prisma } from '@/lib/db/client';

/**
 * Contract Test: POST /api/projects/[projectId]/tickets/[id]/transition (Rollback)
 * Validates rollback functionality from BUILD to INBOX stage
 */

test.describe('POST /api/projects/[projectId]/tickets/[id]/transition - Rollback Contract', () => {
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
  });

  test('should return 200 and reset state for BUILD → INBOX with FAILED job', async ({ request }) => {
    // Setup: Create ticket in BUILD stage with FAILED job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - FAILED',
        description: 'Test ticket for rollback with FAILED job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '123-test-branch',
        version: 5,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'FAILED',
        branch: '123-test-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Execute rollback
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body).toEqual({
      id: ticket.id,
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
      updatedAt: expect.any(String),
    });

    // Verify database state
    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket).toMatchObject({
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    });

    // Verify job was deleted
    const jobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
    expect(jobs).toHaveLength(0);
  });

  test('should return 200 and reset state for BUILD → INBOX with CANCELLED job', async ({ request }) => {
    // Setup: Create ticket in BUILD stage with CANCELLED job (QUICK workflow)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - CANCELLED',
        description: 'Test ticket for rollback with CANCELLED job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '456-cancelled-branch',
        version: 3,
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'CANCELLED',
        branch: '456-cancelled-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Execute rollback
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    });
  });

  test('should return 400 when job is RUNNING', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - RUNNING',
        description: 'Test ticket with RUNNING job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '789-running-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'RUNNING',
        branch: '789-running-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('workflow is still running');
  });

  test('should return 400 when job is COMPLETED', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - COMPLETED',
        description: 'Test ticket with COMPLETED job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '101-completed-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'COMPLETED',
        branch: '101-completed-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('completed successfully');
  });

  test('should return 400 when job is PENDING', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - PENDING',
        description: 'Test ticket with PENDING job',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '102-pending-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'PENDING',
        branch: '102-pending-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('pending');
  });

  test('should return 400 when workflowType is FULL (not QUICK)', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - FULL Workflow',
        description: 'Test ticket with FULL workflow type',
        stage: 'BUILD',
        workflowType: 'FULL',
        branch: '105-full-workflow-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'implement',
        status: 'FAILED',
        branch: '105-full-workflow-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Rollback only available for quick-impl workflows');
  });

  test('should return 400 for SPECIFY → INBOX transition (invalid stage)', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - Wrong Stage',
        description: 'Test ticket in SPECIFY stage',
        stage: 'SPECIFY',
        workflowType: 'FULL',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'specify',
        status: 'FAILED',
        branch: '103-specify-branch',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    // Normal transition validation handles backward moves
    expect(body.error).toContain('Cannot transition from SPECIFY to INBOX');
    expect(body.error).toContain('must progress sequentially');
  });

  test('should ignore AI-BOARD jobs and use most recent workflow job', async ({ request }) => {
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rollback Test - Multiple Jobs',
        description: 'Test ticket with workflow and AI-BOARD jobs',
        stage: 'BUILD',
        workflowType: 'QUICK',
        branch: '104-multi-job-branch',
        projectId: 1,
        updatedAt: new Date(),
      },
    });

    // Create FAILED workflow job (older)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'quick-impl',
        status: 'FAILED',
        branch: '104-multi-job-branch',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T10:00:00Z'),
      },
    });

    // Create AI-BOARD comment job (newer, should be ignored)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: 1,
        command: 'comment-build',
        status: 'COMPLETED',
        branch: '104-multi-job-branch',
        startedAt: new Date('2025-01-01T11:00:00Z'),
        updatedAt: new Date('2025-01-01T11:00:00Z'),
      },
    });

    // Rollback should succeed (uses FAILED workflow job, ignores AI-BOARD job)
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/${ticket.id}/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      stage: 'INBOX',
      workflowType: 'FULL',
      branch: null,
      version: 1,
    });

    // Verify only workflow job was deleted, AI-BOARD job preserved
    const remainingJobs = await prisma.job.findMany({ where: { ticketId: ticket.id } });
    expect(remainingJobs).toHaveLength(1);
    expect(remainingJobs[0]?.command).toBe('comment-build');
  });

  test('should return 404 when ticket does not exist', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/projects/1/tickets/99999/transition`, {
      data: {
        targetStage: 'INBOX',
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
