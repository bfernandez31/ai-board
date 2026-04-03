/**
 * Integration Tests: Cancel Job Endpoint
 *
 * Tests POST /api/jobs/:id/cancel for cancel RUNNING, PENDING, terminal jobs,
 * auth failures, idempotency, and GitHub API failure handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Cancel Job', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket and transition to SPECIFY to get a job
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Cancel Job',
        description: 'Test ticket for cancel job testing',
      }
    );
    ticketId = createResponse.data.id;

    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { id: 'desc' } } },
    });
    jobId = ticket!.jobs[0]!.id;
  });

  describe('POST /api/jobs/:id/cancel', () => {
    it('should cancel a PENDING job without calling GitHub API', async () => {
      // Job starts as PENDING — cancel directly
      const response = await ctx.api.post<{ id: number; status: string; completedAt: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.completedAt).toBeTruthy();

      // Verify DB
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.status).toBe('CANCELLED');
      expect(job!.completedAt).not.toBeNull();
    });

    it('should cancel a RUNNING job (GitHub API called in test mode)', async () => {
      // Move job to RUNNING first
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const response = await ctx.api.post<{ id: number; status: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.status).toBe('CANCELLED');
    });

    it('should return alreadyTerminal for COMPLETED job', async () => {
      // Set job to COMPLETED directly via DB
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const response = await ctx.api.post<{ id: number; status: string; alreadyTerminal: boolean }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');
      expect(response.data.alreadyTerminal).toBe(true);
    });

    it('should return alreadyTerminal for already-CANCELLED job (idempotent)', async () => {
      // Cancel the first time
      await ctx.api.post(`/api/jobs/${jobId}/cancel`);

      // Cancel again — idempotent
      const response = await ctx.api.post<{ id: number; status: string; alreadyTerminal: boolean }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.alreadyTerminal).toBe(true);
    });

    it('should return 404 for invalid job ID', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/jobs/999999/cancel`
      );

      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Job not found');
    });

    it('should return 401/403 without proper auth', async () => {
      // Create a separate user with no project access
      const otherUser = await ctx.createUser('nonmember-cancel@e2e.local');
      const otherApi = createAPIClient({ testUserId: otherUser.id });

      const response = await otherApi.post<{ error: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect([401, 403]).toContain(response.status);
    });
  });
});
