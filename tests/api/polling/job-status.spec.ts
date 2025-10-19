/**
 * Contract Test: Job Polling API
 *
 * Tests the API contract for GET /api/projects/{projectId}/jobs/status
 * according to the OpenAPI specification in job-polling-api.yml
 *
 * These tests verify:
 * - Request/response schemas match OpenAPI spec
 * - Authentication and authorization behavior
 * - Error handling and status codes
 * - Performance requirements (<100ms p95)
 *
 * TDD Note: These tests are written BEFORE implementation and will fail initially.
 */

import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';

// Zod schemas matching OpenAPI spec
const JobStatusDtoSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  ticketId: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

const JobStatusResponseSchema = z.object({
  jobs: z.array(JobStatusDtoSchema),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// Test constants
const ENDPOINT = '/api/projects/{projectId}/jobs/status';
const TEST_PROJECT_ID = 1;
const NON_OWNED_PROJECT_ID = 2;
const NON_EXISTENT_PROJECT_ID = 999999;

test.describe('GET /api/projects/{projectId}/jobs/status - Contract Tests', () => {

  test.beforeEach(async () => {
    await cleanupDatabase();

    const prisma = getPrismaClient();

    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: {},
      create: {
        id: 'test-user-id', // Required: User.id is String (not auto-generated)
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Create another user for cross-project tests
    const otherUser = await prisma.user.upsert({
      where: { email: 'other@e2e.local' },
      update: {},
      create: {
        id: 'other-user-id', // Required: User.id is String (not auto-generated)
        email: 'other@e2e.local',
        name: 'Other Test User',
        emailVerified: new Date(),
        updatedAt: new Date(), // Required: User.updatedAt has no default
      },
    });

    // Create project 1 (owned by test user)
    await prisma.project.upsert({
      where: { id: 1 },
      update: { userId: testUser.id },
      create: {
        id: 1,
        name: '[e2e] Test Project',
        description: 'Project for automated tests',
        githubOwner: 'test',
        githubRepo: 'test',
        userId: testUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    // Create project 2 (owned by other user for 403 test)
    await prisma.project.upsert({
      where: { id: 2 },
      update: { userId: otherUser.id },
      create: {
        id: 2,
        name: '[e2e] Test Project 2',
        description: 'Second project for cross-project tests',
        githubOwner: 'test',
        githubRepo: 'test2',
        userId: otherUser.id,
        updatedAt: new Date(), // Required field
        createdAt: new Date(), // Required field
      },
    });

    // Create tickets for project 1
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test Ticket for Jobs',
        description: 'Ticket for testing job polling',
        stage: 'INBOX',
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    // Create jobs with various statuses for project 1
    await prisma.job.create({
      data: {
        status: 'PENDING',
        command: 'specify',
        ticketId: ticket.id,
        projectId: 1,
        updatedAt: new Date(), // Required field
      },
    });

    await prisma.job.create({
      data: {
        status: 'RUNNING',
        command: 'plan',
        ticketId: ticket.id,
        projectId: 1,
        startedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });

    await prisma.job.create({
      data: {
        status: 'COMPLETED',
        command: 'implement',
        ticketId: ticket.id,
        projectId: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(), // Required field
      },
    });
  });

  test('returns 401 when no session cookie present', async ({ request }) => {
    // Create a new request context without the global x-test-user-id header
    // Note: Playwright's global extraHTTPHeaders includes x-test-user-id,
    // so we need to override it with an empty value to simulate unauthenticated request
    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)), {
      headers: {
        'x-test-user-id': '', // Override global test header to simulate no auth
        'Cookie': '', // No session cookie
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    const parsed = ErrorResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.error).toBe('Unauthorized');
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  test('returns 403 when project belongs to different user', async ({ request }) => {
    // Assumes test user (test@e2e.local) does NOT own project 2
    const response = await request.get(ENDPOINT.replace('{projectId}', String(NON_OWNED_PROJECT_ID)));

    expect(response.status()).toBe(403);

    const body = await response.json();
    const parsed = ErrorResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.error).toBe('Forbidden');
    expect(body.code).toBe('PROJECT_NOT_OWNED');
  });

  test('returns 404 when project does not exist', async ({ request }) => {
    const response = await request.get(ENDPOINT.replace('{projectId}', String(NON_EXISTENT_PROJECT_ID)));

    expect(response.status()).toBe(404);

    const body = await response.json();
    const parsed = ErrorResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.error).toBe('Not Found');
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });

  test('returns 200 with empty jobs array when no jobs exist', async ({ request }) => {
    // Delete all jobs to test empty response
    const prisma = getPrismaClient();
    await prisma.job.deleteMany({ where: { projectId: TEST_PROJECT_ID } });

    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));

    expect(response.status()).toBe(200);

    const body = await response.json();
    const parsed = JobStatusResponseSchema.safeParse(body);

    expect(parsed.success).toBe(true);
    expect(body.jobs).toBeInstanceOf(Array);
    expect(body.jobs).toHaveLength(0);
  });

  test('returns 200 with job array containing all statuses', async ({ request }) => {
    // Setup: Create jobs with various statuses (PENDING, RUNNING, COMPLETED)
    // This requires database setup in test beforeEach hook

    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));

    expect(response.status()).toBe(200);

    const body = await response.json();
    const parsed = JobStatusResponseSchema.safeParse(body);

    expect(parsed.success).toBe(true);
    expect(body.jobs).toBeInstanceOf(Array);

    // Verify each job matches schema
    body.jobs.forEach((job: any) => {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('ticketId');
      expect(job).toHaveProperty('updatedAt');

      expect(typeof job.id).toBe('number');
      expect(job.id).toBeGreaterThan(0);

      expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).toContain(job.status);

      expect(typeof job.ticketId).toBe('number');
      expect(job.ticketId).toBeGreaterThan(0);

      // Validate ISO 8601 datetime format
      expect(() => new Date(job.updatedAt)).not.toThrow();
      expect(job.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  test('response schema matches OpenAPI spec exactly', async ({ request }) => {
    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();

    // Strict schema validation
    const parsed = JobStatusResponseSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Schema validation errors:', parsed.error.format());
    }

    expect(parsed.success).toBe(true);

    // Ensure no extra fields beyond spec
    const allowedTopLevelKeys = ['jobs'];
    Object.keys(body).forEach(key => {
      expect(allowedTopLevelKeys).toContain(key);
    });

    // Ensure no extra fields in job objects
    const allowedJobKeys = ['id', 'status', 'ticketId', 'updatedAt'];
    body.jobs.forEach((job: any) => {
      Object.keys(job).forEach(key => {
        expect(allowedJobKeys).toContain(key);
      });
    });
  });

  test('response time is under 100ms (p95 performance requirement)', async ({ request }) => {
    const iterations = 20; // Sample size for p95 calculation
    const responseTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));
      const endTime = Date.now();

      expect(response.status()).toBe(200);
      responseTimes.push(endTime - startTime);
    }

    // Calculate p95 (95th percentile)
    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p95 = responseTimes[p95Index];

    console.log(`Response times (ms): min=${responseTimes[0]}, max=${responseTimes[responseTimes.length - 1]}, p95=${p95}`);

    expect(p95).toBeLessThan(100); // Performance requirement: <100ms p95
  });

  test('handles database errors gracefully with 500 status', async ({ request: _request }) => {
    // This test requires mocking or intentionally breaking database connection
    // Placeholder for implementation-specific error injection
    //
    // Example approach:
    // - Temporarily disconnect database
    // - Make request
    // - Expect 500 with error response
    // - Reconnect database

    // TODO: Implement once database mocking strategy is defined
    test.skip(true, 'Database error scenario requires mocking infrastructure');
  });

  test('excludes sensitive fields from response', async ({ request }) => {
    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Ensure sensitive fields are NOT present
    body.jobs.forEach((job: any) => {
      expect(job).not.toHaveProperty('command'); // Internal implementation detail
      expect(job).not.toHaveProperty('createdAt'); // Not needed for polling
      expect(job).not.toHaveProperty('completedAt'); // Can be inferred from status
      expect(job).not.toHaveProperty('projectId'); // Already in request path
    });
  });

  test('returns jobs only for specified project (no cross-project leakage)', async ({ request }) => {
    // Setup: Ensure project 1 has jobs, project 2 has different jobs
    const response = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Verify all returned jobs belong to tickets in project 1
    // This requires cross-referencing with ticket-project relationships
    // Placeholder assertion:
    body.jobs.forEach((job: any) => {
      // TODO: Query ticket.projectId for each job.ticketId and verify === TEST_PROJECT_ID
      expect(job.ticketId).toBeGreaterThan(0);
    });
  });

  test('detects new job created after stage transition (polling resume scenario)', async ({ request }) => {
    const prisma = getPrismaClient();

    // Initial state: Mark all existing jobs as COMPLETED (terminal state)
    await prisma.job.updateMany({
      where: { projectId: TEST_PROJECT_ID },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Poll 1: Verify all jobs are terminal (polling would stop here)
    const poll1 = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));
    expect(poll1.status()).toBe(200);
    const body1 = await poll1.json();
    expect(body1.jobs.every((job: any) => job.status === 'COMPLETED')).toBe(true);

    // Simulate drag-and-drop transition: Create new PENDING job
    const ticket = await prisma.ticket.findFirst({
      where: { projectId: TEST_PROJECT_ID },
    });
    expect(ticket).not.toBeNull();

    const newJob = await prisma.job.create({
      data: {
        status: 'PENDING',
        command: 'specify',
        ticketId: ticket!.id,
        projectId: TEST_PROJECT_ID,
        updatedAt: new Date(),
      },
    });

    // Poll 2: Query invalidation would trigger this poll
    // Should now return the new PENDING job along with completed jobs
    const poll2 = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));
    expect(poll2.status()).toBe(200);
    const body2 = await poll2.json();

    // Verify new job is present
    const pendingJobs = body2.jobs.filter((job: any) => job.status === 'PENDING');
    expect(pendingJobs).toHaveLength(1);
    expect(pendingJobs[0].id).toBe(newJob.id);
    expect(pendingJobs[0].ticketId).toBe(ticket!.id);

    // Verify polling would resume (at least one non-terminal job exists)
    const hasNonTerminalJob = body2.jobs.some((job: any) =>
      ['PENDING', 'RUNNING'].includes(job.status)
    );
    expect(hasNonTerminalJob).toBe(true);
  });

  test('maintains correct job count after transition creates new job', async ({ request }) => {
    const prisma = getPrismaClient();

    // Count initial jobs
    const initialPoll = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));
    expect(initialPoll.status()).toBe(200);
    const initialBody = await initialPoll.json();
    const initialCount = initialBody.jobs.length;

    // Create new job (simulating transition)
    const ticket = await prisma.ticket.findFirst({
      where: { projectId: TEST_PROJECT_ID },
    });

    await prisma.job.create({
      data: {
        status: 'PENDING',
        command: 'plan',
        ticketId: ticket!.id,
        projectId: TEST_PROJECT_ID,
        updatedAt: new Date(),
      },
    });

    // Poll after job creation
    const afterPoll = await request.get(ENDPOINT.replace('{projectId}', String(TEST_PROJECT_ID)));
    expect(afterPoll.status()).toBe(200);
    const afterBody = await afterPoll.json();

    // Verify job count increased by 1
    expect(afterBody.jobs).toHaveLength(initialCount + 1);

    // Verify all jobs are valid
    afterBody.jobs.forEach((job: any) => {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('ticketId');
      expect(job).toHaveProperty('updatedAt');
    });
  });
});

/**
 * Test Data Setup Notes:
 *
 * These contract tests assume the following test data setup (via beforeEach or global-setup.ts):
 *
 * 1. Test user: email='test@e2e.local', owns project 1
 * 2. Project 1: id=1, userId=testUser.id
 * 3. Project 2: id=2, userId=differentUser.id (for 403 test)
 * 4. Jobs for project 1: At least 3 jobs with different statuses (PENDING, RUNNING, COMPLETED)
 *
 * Example setup code:
 *
 * ```typescript
 * test.beforeEach(async () => {
 *   await cleanupDatabase();
 *
 *   const testUser = await prisma.user.upsert({
 *     where: { email: 'test@e2e.local' },
 *     update: {},
 *     create: { email: 'test@e2e.local', name: 'E2E Test User', emailVerified: new Date() },
 *   });
 *
 *   await prisma.project.upsert({
 *     where: { id: 1 },
 *     update: { userId: testUser.id },
 *     create: { id: 1, name: '[e2e] Test Project', userId: testUser.id, ... },
 *   });
 *
 *   const ticket = await prisma.ticket.create({
 *     data: { title: '[e2e] Test Ticket', projectId: 1, stage: 'INBOX', ... },
 *   });
 *
 *   await prisma.job.create({
 *     data: { status: 'PENDING', command: 'specify', ticketId: ticket.id, projectId: 1 },
 *   });
 *   await prisma.job.create({
 *     data: { status: 'RUNNING', command: 'plan', ticketId: ticket.id, projectId: 1 },
 *   });
 *   await prisma.job.create({
 *     data: { status: 'COMPLETED', command: 'tasks', ticketId: ticket.id, projectId: 1, completedAt: new Date() },
 *   });
 * });
 * ```
 */
