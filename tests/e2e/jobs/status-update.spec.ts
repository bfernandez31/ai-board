import { test, expect } from '../../fixtures/auth';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

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

  test.beforeEach(async () => {
    await cleanupDatabase();

    // Create test ticket for Job foreign key constraint
    await prisma.ticket.create({
      data: {
        id: 1,
        title: '[e2e] Test Ticket for Jobs',
        description: 'Ticket for testing Job status updates',
        stage: 'INBOX',
        projectId: 1,
      },
    });
  });

  test('T006: should update RUNNING job to COMPLETED with timestamp', async ({ request }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'specify',
        status: 'RUNNING',
        branch: 'feature/test',
        startedAt: startTime,
      },
    });

    // Action: Send PATCH request to mark as COMPLETED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' }
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

  test('T007: should update RUNNING job to FAILED with timestamp', async ({ request }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'plan',
        status: 'RUNNING',
        branch: 'feature/bug-fix',
        startedAt: startTime,
      },
    });

    // Action: Send PATCH request to mark as FAILED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' }
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

  test('T008: should update RUNNING job to CANCELLED with timestamp', async ({ request }) => {
    // Setup: Create job in RUNNING state
    const startTime = new Date('2025-10-10T10:00:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'build',
        status: 'RUNNING',
        branch: 'feature/cancelled-test',
        startedAt: startTime,
      },
    });

    // Action: Send PATCH request to mark as CANCELLED
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'CANCELLED' }
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

  test('T009: should handle idempotent updates (COMPLETED → COMPLETED)', async ({ request }) => {
    // Setup: Create job already COMPLETED
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'verify',
        status: 'COMPLETED',
        branch: 'feature/idempotent',
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
      },
    });

    // Action: Send same status again (idempotent request)
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' }
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

  test('T010: should reject invalid transitions (COMPLETED → FAILED)', async ({ request }) => {
    // Setup: Create job already COMPLETED
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'COMPLETED',
        branch: 'feature/invalid-transition',
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: new Date('2025-10-10T10:05:00Z'),
      },
    });

    // Action: Attempt invalid transition
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' }
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

  test('T011: should reject invalid status value', async ({ request }) => {
    // Setup: Create job in RUNNING state
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'deploy',
        status: 'RUNNING',
        branch: 'feature/invalid-status',
        startedAt: new Date(),
      },
    });

    // Action: Send request with invalid status
    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'INVALID' }
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

  test('T012: should return 404 for non-existent job', async ({ request }) => {
    // Action: Send request for non-existent job ID
    const response = await request.patch(`${BASE_URL}/api/jobs/999999/status`, {
      data: { status: 'COMPLETED' }
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

  test.beforeEach(async () => {
    await cleanupDatabase();

    // Create test ticket for Job foreign key constraint
    await prisma.ticket.create({
      data: {
        id: 1,
        title: '[e2e] Test Ticket for Jobs',
        description: 'Ticket for testing Job status updates',
        stage: 'INBOX',
        projectId: 1,
      },
    });
  });

  test('should reject transition from FAILED to COMPLETED', async ({ request }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'FAILED',
        branch: 'test',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from FAILED to COMPLETED');
  });

  test('should reject transition from CANCELLED to COMPLETED', async ({ request }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'CANCELLED',
        branch: 'test',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from CANCELLED to COMPLETED');
  });

  test('should reject transition from PENDING to COMPLETED (must go through RUNNING)', async ({ request }) => {
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'PENDING',
        branch: 'test',
        startedAt: new Date(),
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid transition from PENDING to COMPLETED');
  });

  test('should handle idempotent FAILED → FAILED', async ({ request }) => {
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'FAILED',
        branch: 'test',
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'FAILED' }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('FAILED');

    // Verify completedAt unchanged
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob!.completedAt!.toISOString()).toBe(completedTime.toISOString());
  });

  test('should handle idempotent CANCELLED → CANCELLED', async ({ request }) => {
    const completedTime = new Date('2025-10-10T10:05:00Z');
    const job = await prisma.job.create({
      data: {
        ticketId: 1,
        command: 'test',
        status: 'CANCELLED',
        branch: 'test',
        startedAt: new Date('2025-10-10T10:00:00Z'),
        completedAt: completedTime,
      },
    });

    const response = await request.patch(`${BASE_URL}/api/jobs/${job.id}/status`, {
      data: { status: 'CANCELLED' }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('CANCELLED');

    // Verify completedAt unchanged
    const unchangedJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(unchangedJob!.completedAt!.toISOString()).toBe(completedTime.toISOString());
  });
});
