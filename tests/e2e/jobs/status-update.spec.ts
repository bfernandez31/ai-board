import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../../helpers/db-cleanup';
import { getWorkflowHeaders } from '../../helpers/workflow-auth';

/**
 * E2E Tests: Job Status Update Feature
 * Tests complete workflows for updating job status when workflows complete
 *
 * NOTE: These tests call the API endpoint directly, not GitHub Actions
 * They validate the behavior that will be used by the workflow
 *
 * These tests MUST FAIL until the implementation is complete
 */

test.describe('Job Status Update - Workflow Completion Scenarios', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();
  let nextTicketNumber = 1;
  let testTicket: any;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;

    // Create test ticket for Job foreign key constraint
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    testTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test Ticket for Jobs',
        description: 'Ticket for testing Job status updates',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });
  });

  test('T006: should update RUNNING job to COMPLETED with timestamp', async ({ request , projectId }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: 'feature/test',
        projectId,
        startedAt: startTime,
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Send PATCH request to mark as COMPLETED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 200 response
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(job.id);
    expect(body.status).toBe('COMPLETED');
    expect(body.completedAt).toBeDefined();
    expect(typeof body.completedAt).toBe('string');

    // Verify database update
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updatedJob).toBeDefined();
    expect(updatedJob!.status).toBe('COMPLETED');
    expect(updatedJob!.completedAt).toBeDefined();
    expect(updatedJob!.completedAt).not.toBeNull();

    // Verify completedAt is recent (within last 5 seconds)
    const completedAt = new Date(updatedJob!.completedAt!);
    const now = new Date();
    const timeDiff = now.getTime() - completedAt.getTime();
    expect(timeDiff).toBeLessThan(5000); // 5 seconds

    // Verify startedAt unchanged
    expect(updatedJob!.startedAt.toISOString()).toBe(startTime.toISOString());
  });

  test('T007: should update RUNNING job to FAILED with timestamp', async ({ request , projectId }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'plan',
        status: 'RUNNING',
        branch: 'feature/bug-fix',
        projectId,
        startedAt: startTime,
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Send PATCH request to mark as FAILED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 200 response
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(job.id);
    expect(body.status).toBe('FAILED');
    expect(body.completedAt).toBeDefined();

    // Verify database update
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updatedJob).toBeDefined();
    expect(updatedJob!.status).toBe('FAILED');
    expect(updatedJob!.completedAt).toBeDefined();
    expect(updatedJob!.completedAt).not.toBeNull();

    // Verify startedAt unchanged
    expect(updatedJob!.startedAt.toISOString()).toBe(startTime.toISOString());
  });

  test('T008: should update RUNNING job to CANCELLED with timestamp', async ({ request , projectId }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'build',
        status: 'RUNNING',
        branch: 'feature/cancelled-test',
        projectId,
        startedAt: startTime,
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Send PATCH request to mark as CANCELLED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'CANCELLED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 200 response
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(job.id);
    expect(body.status).toBe('CANCELLED');
    expect(body.completedAt).toBeDefined();

    // Verify database update
    const updatedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updatedJob).toBeDefined();
    expect(updatedJob!.status).toBe('CANCELLED');
    expect(updatedJob!.completedAt).toBeDefined();
    expect(updatedJob!.completedAt).not.toBeNull();

    // Verify startedAt unchanged
    expect(updatedJob!.startedAt.toISOString()).toBe(startTime.toISOString());
  });

  test('T009: should handle idempotent updates (COMPLETED → COMPLETED)', async ({ request , projectId }) => {
    // Setup: Create job already COMPLETED
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'verify',
        status: 'COMPLETED',
        branch: 'feature/idempotent',
        projectId,
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Send same status again (idempotent request)
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 200 response (success, no error)
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(job.id);
    expect(body.status).toBe('COMPLETED');
    expect(body.completedAt).toBeDefined();

    // Verify NO database changes
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob).toBeDefined();
    expect(unchangedJob!.status).toBe('COMPLETED');

    // Verify completedAt UNCHANGED
    expect(unchangedJob!.completedAt!.toISOString()).toBe(completedTime.toISOString());
  });

  test('T010: should reject invalid transitions (COMPLETED → FAILED)', async ({ request , projectId }) => {
    // Setup: Create job already COMPLETED
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'COMPLETED',
        branch: 'feature/invalid-transition',
        projectId,
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: new Date('2025-10-10T10:05:00Z'),
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Attempt invalid transition
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 400 response
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid transition from COMPLETED to FAILED');

    // Verify NO database changes
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob).toBeDefined();
    expect(unchangedJob!.status).toBe('COMPLETED'); // Still COMPLETED
  });

  test('T011: should reject invalid status value', async ({ request , projectId }) => {
    // Setup: Create job in RUNNING state
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'deploy',
        status: 'RUNNING',
        branch: 'feature/invalid-status',
        projectId,
        startedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    // Action: Send request with invalid status
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'INVALID' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 400 response
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');

    // Should include Zod validation error details
    if (body.details) {
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThan(0);
      expect(body.details[0]).toHaveProperty('message');
      expect(body.details[0]).toHaveProperty('path');
    }

    // Verify NO database changes
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob).toBeDefined();
    expect(unchangedJob!.status).toBe('RUNNING'); // Still RUNNING
  });

  test('T012: should return 404 for non-existent job', async ({ request , projectId }) => {
    // Action: Send request for non-existent job ID
    const response = await request.patch(`${BASE_URL}/api/jobs/999999/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Assert: HTTP 404 response
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('not found');
  });
});

test.describe('Job Status Update - Additional Edge Cases', () => {
  const BASE_URL = 'http://localhost:3000';
  const prisma = getPrismaClient();
  let nextTicketNumber = 1;
  let testTicket: any;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;

    // Create test ticket for Job foreign key constraint
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    testTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        title: '[e2e] Test Ticket for Jobs',
        description: 'Ticket for testing Job status updates',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(), // Required field
      },
    });
  });

  test('should reject transition from FAILED to COMPLETED', async ({ request , projectId }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'FAILED',
        branch: 'test',
        projectId,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from FAILED to COMPLETED');
  });

  test('should reject transition from CANCELLED to COMPLETED', async ({ request , projectId }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'CANCELLED',
        branch: 'test',
        projectId,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from CANCELLED to COMPLETED');
  });

  test('should reject transition from PENDING to COMPLETED (must go through RUNNING)', async ({ request , projectId }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'PENDING',
        branch: 'test',
        projectId,
        startedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from PENDING to COMPLETED');
  });

  test('should handle idempotent FAILED → FAILED', async ({ request , projectId }) => {
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'FAILED',
        branch: 'test',
        projectId,
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
        updatedAt: new Date(), // Required field
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('FAILED');

    // Verify completedAt unchanged
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob!.completedAt!.toISOString()).toBe(completedTime.toISOString());
  });

  test('should handle idempotent CANCELLED → CANCELLED', async ({ request , projectId }) => {
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'test',
        status: 'CANCELLED',
        branch: 'test',
        projectId,
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
        updatedAt: new Date(), // Required field
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'CANCELLED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('CANCELLED');

    // Verify completedAt unchanged
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob!.completedAt!.toISOString()).toBe(completedTime.toISOString());
  });
});
