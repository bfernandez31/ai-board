import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../../helpers/db-cleanup';
import { getWorkflowHeaders } from '../../helpers/workflow-auth';

/**
 * Contract Test: PATCH /api/jobs/[id]/status
 * Validates API contract from specs/019-update-job-on/contracts/job-update-api.yaml
 *
 * These tests MUST FAIL until the API endpoint is implemented
 */

test.describe('PATCH /api/jobs/[id]/status - Contract Validation', () => {
  const BASE_URL = 'http://localhost:3000';
  let testJobId: number;
  let nextTicketNumber = 1;
  let testTicket: any;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Reset ticket counter
    nextTicketNumber = 1;

    const prisma = getPrismaClient();

    // Create test ticket for Job foreign key constraint
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const testTicket = await prisma.ticket.create({
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

    // Create a test job in RUNNING state
    const job = await prisma.job.create({
      data: {
        ticketId: testTicket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: 'test-branch',
        startedAt: new Date(),
        projectId,
        updatedAt: new Date(), // Required field
      },
    });
    testJobId = job.id;
  });

  test('should have correct endpoint path pattern', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Endpoint should exist (not 404)
    expect(response.status()).not.toBe(404);
  });

  test('should accept PATCH method', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Should not return 405 Method Not Allowed
    expect(response.status()).not.toBe(405);
  });

  test('should return JSON content type', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('should validate request body schema (Zod)', async ({ request , projectId }) => {
    // Missing status field
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: {},
      headers: getWorkflowHeaders(),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should validate status enum values', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'INVALID_STATUS' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    // Error message should indicate invalid request (Zod validation)
    expect(body.error.toLowerCase()).toMatch(/invalid|request/);
  });

  test('should accept COMPLETED status value', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Should be either 200 (success) or 400 (validation), not 500
    expect([200, 400]).toContain(response.status());
  });

  test('should accept FAILED status value', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'FAILED' },
      headers: getWorkflowHeaders()
    });

    expect([200, 400]).toContain(response.status());
  });

  test('should accept CANCELLED status value', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'CANCELLED' },
      headers: getWorkflowHeaders()
    });

    expect([200, 400]).toContain(response.status());
  });

  test('should return 200 for successful update', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(200);
  });

  test('should return response schema matching OpenAPI spec', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Required fields per OpenAPI spec
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');

    expect(body).toHaveProperty('status');
    expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).toContain(body.status);

    expect(body).toHaveProperty('completedAt');
    if (body.completedAt !== null) {
      expect(typeof body.completedAt).toBe('string');
      expect(new Date(body.completedAt).toISOString()).toBe(body.completedAt);
    }

    // Should not return extra fields
    expect(Object.keys(body).sort()).toEqual(['id', 'status', 'completedAt'].sort());
  });

  test('should return 400 for invalid state transition', async ({ request , projectId }) => {
    // First, complete the job
    await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Try to transition from COMPLETED to FAILED (invalid)
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'FAILED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('transition');
  });

  test('should return 404 for non-existent job', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/999999/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toContain('not found');
  });

  test('should return error response schema for validation errors', async ({ request , projectId }) => {
    const response = await request.patch(`${BASE_URL}/api/jobs/${testJobId}/status`, {
      data: { status: 'INVALID' },
      headers: getWorkflowHeaders()
    });

    expect(response.status()).toBe(400);
    const body = await response.json();

    // Required fields per OpenAPI error schema
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');

    // Optional details field for Zod validation errors
    if (body.details) {
      expect(Array.isArray(body.details)).toBe(true);
      if (body.details.length > 0) {
        expect(body.details[0]).toHaveProperty('message');
        expect(body.details[0]).toHaveProperty('path');
      }
    }
  });

  test('should handle database errors gracefully with 500', async ({ request , projectId }) => {
    // Use an invalid job ID format to potentially trigger database error
    // This tests error handling, not just validation
    const response = await request.patch(`${BASE_URL}/api/jobs/abc/status`, {
      data: { status: 'COMPLETED' },
      headers: getWorkflowHeaders()
    });

    // Should return either 400 (validation) or 500 (error), not crash
    expect([400, 500]).toContain(response.status());
  });
});
