/**
 * Integration Tests: Jobs Status
 *
 * Migrated from: tests/api/polling/job-status.spec.ts, tests/e2e/jobs/*.spec.ts
 * Tests for job status API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { waitForLatestJobId } from '@/tests/helpers/job-helpers';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import { createToken } from '@/lib/db/tokens';
import { generatePersonalAccessToken } from '@/lib/tokens/generate';

// Workflow token for PATCH /api/jobs/:id/status endpoint
const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

/**
 * Create an API client with workflow token authentication
 * (for job status updates which require workflow auth, not user auth)
 */
function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Jobs Status', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Jobs',
        description: 'Test ticket for job status testing',
      }
    );
    ticketId = createResponse.data.id;

    // Transition to create a job
    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    // Get the job ID
    jobId = await waitForLatestJobId(prisma, ticketId);
  });

  describe('GET /api/projects/:projectId/jobs/status', () => {
    it('should return job status for project', async () => {
      const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string; command: string }> }>(
        `/api/projects/${ctx.projectId}/jobs/status`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.jobs)).toBe(true);
      expect(response.data.jobs.length).toBeGreaterThan(0);

      const job = response.data.jobs.find((j) => j.id === jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('PENDING');
      expect(job!.command).toBe('specify');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get('/api/projects/999999/jobs/status');

      expect(response.status).toBe(404);
    });

    it('should preserve PAT identity when a conflicting x-test-user-id header is present', async () => {
      const otherUser = await ctx.createUser('jobs-conflict@e2e.local');
      const pat = generatePersonalAccessToken();

      await createToken(
        'test-user-id',
        '[e2e] Jobs Status PAT',
        pat.hash,
        pat.salt,
        pat.preview
      );

      const patClient = createAPIClient({
        testUserId: otherUser.id,
        enableTestAuthOverride: false,
        defaultHeaders: {
          Authorization: `Bearer ${pat.token}`,
        },
      });

      const response = await patClient.get<{ jobs: Array<{ id: number }> }>(
        `/api/projects/${ctx.projectId}/jobs/status`
      );

      expect(response.status).toBe(200);
      expect(response.data.jobs.some((job) => job.id === jobId)).toBe(true);
    });

    it('should continue to allow explicit test override requests for the seeded test user', async () => {
      const response = await ctx.api.get<{ jobs: Array<{ id: number }> }>(
        `/api/projects/${ctx.projectId}/jobs/status`,
        {
          enableTestAuthOverride: true,
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.jobs.some((job) => job.id === jobId)).toBe(true);
    });
  });

  describe('PATCH /api/jobs/:id/status', () => {
    it('should update job status to RUNNING', async () => {
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'RUNNING' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('RUNNING');
      expect(job?.startedAt).not.toBeNull();
    });

    it('should update job status to COMPLETED', async () => {
      // First set to RUNNING
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      // Then set to COMPLETED
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'COMPLETED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
      expect(job?.completedAt).not.toBeNull();
    });

    it('should update job status to FAILED', async () => {
      // First set to RUNNING
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      // Then set to FAILED
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'FAILED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('FAILED');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('FAILED');
      expect(job?.completedAt).not.toBeNull();
    });

    it('should return 400 for invalid status', async () => {
      const response = await workflowApi.patch<{ error: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'INVALID_STATUS' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await workflowApi.patch(
        '/api/jobs/999999/status',
        { status: 'RUNNING' }
      );

      expect(response.status).toBe(404);
    });

    it('should update status to CANCELLED', async () => {
      // First transition to RUNNING (PENDING → RUNNING is required before CANCELLED)
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      // Then transition to CANCELLED (RUNNING → CANCELLED is valid)
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'CANCELLED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
    });

    it('keeps FAILED authoritative when Gemini telemetry is partial', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      await prisma.job.update({
        where: { id: jobId },
        data: {
          inputTokens: 700,
          outputTokens: 180,
          model: 'gemini-2.5-flash',
          toolsUsed: ['read_file'],
        },
      });

      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'FAILED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('FAILED');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('FAILED');
      expect(job?.inputTokens).toBe(700);
      expect(job?.outputTokens).toBe(180);
      expect(job?.model).toBe('gemini-2.5-flash');
      expect(job?.toolsUsed).toEqual(['read_file']);
    });

    it('backfills duration for Gemini failures when native telemetry is missing', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const startedAt = new Date(Date.now() - 6_000);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          startedAt,
          durationMs: null,
        },
      });

      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'FAILED' }
      );

      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('FAILED');
      expect(job?.durationMs).not.toBeNull();
      expect(job!.durationMs!).toBeGreaterThanOrEqual(5_000);
    });
  });

  describe('Quality Score on COMPLETED status', () => {
    it('should persist qualityScore and qualityScoreDetails when COMPLETED', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const qualityScoreDetails = JSON.stringify({
        dimensions: [
          { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
        ],
        threshold: 'Good',
        computedAt: '2026-03-17T10:30:00Z',
      });

      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        {
          status: 'COMPLETED',
          qualityScore: 83,
          qualityScoreDetails,
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.qualityScore).toBe(83);
      expect(job?.qualityScoreDetails).toBe(qualityScoreDetails);
    });

    it('should silently ignore qualityScore when status is RUNNING', async () => {
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        {
          status: 'RUNNING',
          qualityScore: 83,
          qualityScoreDetails: '{}',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.qualityScore).toBeNull();
      expect(job?.qualityScoreDetails).toBeNull();
    });

    it('should accept COMPLETED without qualityScore (backwards compatible)', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'COMPLETED' }
      );

      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.qualityScore).toBeNull();
    });

    it('should reject qualityScore outside 0-100 range', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      const response = await workflowApi.patch<{ error: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'COMPLETED', qualityScore: 101 }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Job status lifecycle', () => {
    it('should track full job lifecycle: PENDING → RUNNING → COMPLETED', async () => {
      // Verify initial PENDING state (startedAt is set at job creation)
      let job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('PENDING');
      expect(job?.startedAt).not.toBeNull(); // Set at job creation
      expect(job?.completedAt).toBeNull();

      // Transition to RUNNING
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('RUNNING');
      expect(job?.startedAt).not.toBeNull();
      expect(job?.completedAt).toBeNull();

      // Transition to COMPLETED
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
      job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
      expect(job?.startedAt).not.toBeNull();
      expect(job?.completedAt).not.toBeNull();
    });
  });

  describe('workflowRunId Extension', () => {
    it('should populate workflowRunId on RUNNING status via API', async () => {
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'RUNNING', workflowRunId: 12345678901 }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.workflowRunId).toBe(BigInt(12345678901));
    });

    it('should keep workflowRunId null when not provided', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.workflowRunId).toBeNull();
    });

    it('should first-write-wins — second update does not overwrite workflowRunId', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', workflowRunId: BigInt(11111111111), startedAt: new Date() },
      });

      const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, {
        status: 'RUNNING',
        workflowRunId: 22222222222,
      });

      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job!.workflowRunId).toBe(BigInt(11111111111));
    });

    it('should return 409 when RUNNING callback hits a CANCELLED job', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });

      const response = await workflowApi.patch<{ error: string; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'RUNNING', workflowRunId: 99999999999 }
      );

      expect(response.status).toBe(409);
      expect(response.data.error).toBe('Job already cancelled');
      expect(response.data.status).toBe('CANCELLED');
    });
  });

  describe('pluginVersion and agentCliVersion persistence', () => {
    it('persists pluginVersion and agentCliVersion on RUNNING transition', async () => {
      const response = await workflowApi.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        {
          status: 'RUNNING',
          workflowRunId: 12345678901,
          pluginVersion: '1.0.1',
          agentCliVersion: '1.0.92 (Claude Code)',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.pluginVersion).toBe('1.0.1');
      expect(job?.agentCliVersion).toBe('1.0.92 (Claude Code)');
    });

    it('rejects oversize version strings', async () => {
      const response = await workflowApi.patch<{ error: string }>(
        `/api/jobs/${jobId}/status`,
        {
          status: 'RUNNING',
          agentCliVersion: 'a'.repeat(41),
        }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('first-write-wins on retried RUNNING PATCH', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date(), pluginVersion: 'A', agentCliVersion: 'B' },
      });

      const response = await workflowApi.patch(
        `/api/jobs/${jobId}/status`,
        { status: 'RUNNING', pluginVersion: 'C', agentCliVersion: 'D' }
      );

      expect(response.status).toBe(200);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.pluginVersion).toBe('A');
      expect(job?.agentCliVersion).toBe('B');
    });

    it('non-RUNNING transitions ignore version fields', async () => {
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      await workflowApi.patch(`/api/jobs/${jobId}/status`, {
        status: 'COMPLETED',
        pluginVersion: 'X',
        agentCliVersion: 'Y',
      });

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.pluginVersion).toBeNull();
      expect(job?.agentCliVersion).toBeNull();
    });
  });

  describe('Multiple jobs per ticket', () => {
    it('should handle multiple jobs for same ticket', async () => {
      // Complete the first job using workflow API
      const runningResponse = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      expect(runningResponse.status).toBe(200);

      const completedResponse = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
      expect(completedResponse.status).toBe(200);

      // Transition to next stage to create second job (user auth)
      const transitionResponse = await ctx.api.post<{ stage: string; jobId?: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'PLAN' }
      );

      // Transition should succeed and create a new job
      expect(transitionResponse.status).toBe(200);
      expect(transitionResponse.data.stage).toBe('PLAN');

      // Get all jobs for the ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { id: 'asc' } } },
      });

      expect(ticket?.jobs.length).toBe(2);
      expect(ticket?.jobs[0]?.status).toBe('COMPLETED');
      expect(ticket?.jobs[0]?.command).toBe('specify');
      expect(ticket?.jobs[1]?.status).toBe('PENDING');
      expect(ticket?.jobs[1]?.command).toBe('plan');
    });
  });
});
