import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { waitForLatestJobId } from '@/tests/helpers/job-helpers';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

const SAMPLE_CLAUDE_OUTPUT = `Let me analyze the issue.

> Read file: src/index.ts

I see the problem.

> Edit file: src/index.ts

Fixed the issue.`;

describe('Job Logs API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Job Logs',
        description: 'Test ticket for job logs testing',
      }
    );
    ticketId = createResponse.data.id;

    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    jobId = await waitForLatestJobId(prisma, ticketId);

    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
  });

  describe('POST /api/jobs/:id/logs', () => {
    it('should upload logs with workflow auth', async () => {
      const response = await workflowApi.post<{ jobId: number; entryCount: number; rawSize: number; truncated: boolean }>(
        `/api/jobs/${jobId}/logs`,
        { agentType: 'CLAUDE', rawOutput: SAMPLE_CLAUDE_OUTPUT }
      );

      expect(response.status).toBe(201);
      expect(response.data.jobId).toBe(jobId);
      expect(response.data.entryCount).toBeGreaterThan(0);
      expect(response.data.rawSize).toBeGreaterThan(0);
      expect(response.data.truncated).toBe(false);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.logStatus).toBe('AVAILABLE');
      expect(job?.logSummary).toBeTruthy();
    });

    it('should return 200 for duplicate upload (idempotent)', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      const response = await workflowApi.post<{ message: string }>(
        `/api/jobs/${jobId}/logs`,
        { agentType: 'CLAUDE', rawOutput: 'different output' }
      );

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Log already exists');
    });

    it('should reject invalid agentType', async () => {
      const response = await workflowApi.post(
        `/api/jobs/${jobId}/logs`,
        { agentType: 'INVALID', rawOutput: 'test' }
      );

      expect(response.status).toBe(400);
    });

    it('should reject requests without auth', async () => {
      const unauthClient = createAPIClient({
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      });

      const response = await unauthClient.post(
        `/api/jobs/${jobId}/logs`,
        { agentType: 'CLAUDE', rawOutput: 'test' }
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await workflowApi.post(
        `/api/jobs/999999/logs`,
        { agentType: 'CLAUDE', rawOutput: 'test' }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/jobs/:id/logs', () => {
    it('should return logs for authorized user', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      const response = await ctx.api.get<{
        jobId: number;
        agentType: string;
        entries: unknown[];
        entryCount: number;
        rawSize: number;
        truncated: boolean;
        createdAt: string;
      }>(`/api/jobs/${jobId}/logs`);

      expect(response.status).toBe(200);
      expect(response.data.jobId).toBe(jobId);
      expect(response.data.agentType).toBe('CLAUDE');
      expect(response.data.entries.length).toBeGreaterThan(0);
      expect(response.data.entryCount).toBeGreaterThan(0);
      expect(response.data.truncated).toBe(false);
      expect(response.data.createdAt).toBeTruthy();
    });

    it('should return 404 when no log exists (NONE status)', async () => {
      const response = await ctx.api.get<{ logStatus: string }>(
        `/api/jobs/${jobId}/logs`
      );

      expect(response.status).toBe(404);
      expect(response.data.logStatus).toBe('NONE');
    });

    it('should return 410 for pruned logs', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      await prisma.jobLog.delete({ where: { jobId } });
      await prisma.job.update({
        where: { id: jobId },
        data: { logStatus: 'PRUNED', logSummary: null },
      });

      const response = await ctx.api.get<{ logStatus: string }>(
        `/api/jobs/${jobId}/logs`
      );

      expect(response.status).toBe(410);
      expect(response.data.logStatus).toBe('PRUNED');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await ctx.api.get('/api/jobs/999999/logs');

      expect(response.status).toBe(404);
    });

    it('should return milestone summary for completed job', async () => {
      const completedOutput = `Let me implement the feature.

> Read file: src/main.ts

Reading the main entry point.

> Edit file: src/main.ts

Updated the main entry.

> Bash: npm test

All tests pass. Implementation complete.`;

      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: completedOutput,
      });

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.logStatus).toBe('AVAILABLE');
      expect(job?.logSummary).toContain('Completed');
      expect(job?.logSummary).toContain('tool invocation');

      const response = await ctx.api.get<{
        entries: Array<{ eventType: string; content: string }>;
      }>(`/api/jobs/${jobId}/logs`);

      expect(response.status).toBe(200);
      const toolEntries = response.data.entries.filter((e) => e.eventType === 'tool_invocation');
      expect(toolEntries.length).toBeGreaterThanOrEqual(2);
    });

    it('should prune logs older than retention period', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: { completedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });

      const { pruneExpiredLogs } = await import('@/lib/logs/prune-expired-logs');
      const result = await pruneExpiredLogs(30);

      expect(result.pruned).toBeGreaterThanOrEqual(1);
      expect(result.errors).toBe(0);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.logStatus).toBe('PRUNED');
      expect(job?.logSummary).toBeNull();

      const jobLog = await prisma.jobLog.findUnique({ where: { jobId } });
      expect(jobLog).toBeNull();
    });

    it('should not prune logs within retention period', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      const { pruneExpiredLogs } = await import('@/lib/logs/prune-expired-logs');
      const result = await pruneExpiredLogs(30);

      expect(result.pruned).toBe(0);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.logStatus).toBe('AVAILABLE');
    });

    it('should preserve job telemetry after pruning', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: {
          completedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.05,
          durationMs: 30000,
        },
      });

      const { pruneExpiredLogs } = await import('@/lib/logs/prune-expired-logs');
      await pruneExpiredLogs(30);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.logStatus).toBe('PRUNED');
      expect(job?.inputTokens).toBe(1000);
      expect(job?.outputTokens).toBe(500);
      expect(job?.costUsd).toBeCloseTo(0.05);
      expect(job?.durationMs).toBe(30000);
    });

    it('should return 410 for pruned logs via GET', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CLAUDE',
        rawOutput: SAMPLE_CLAUDE_OUTPUT,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: { completedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });

      const { pruneExpiredLogs } = await import('@/lib/logs/prune-expired-logs');
      await pruneExpiredLogs(30);

      const response = await ctx.api.get<{ logStatus: string }>(
        `/api/jobs/${jobId}/logs`
      );

      expect(response.status).toBe(410);
      expect(response.data.logStatus).toBe('PRUNED');
    });

    it('should return consistent format across agent types', async () => {
      const codexOutput = `Thinking about the problem...
Running: npm test
Output: All tests passed
Writing file: src/fix.ts
Done.`;

      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        agentType: 'CODEX',
        rawOutput: codexOutput,
      });

      const response = await ctx.api.get<{
        agentType: string;
        entries: Array<{ timestamp: string; eventType: string; content: string }>;
      }>(`/api/jobs/${jobId}/logs`);

      expect(response.status).toBe(200);
      expect(response.data.agentType).toBe('CODEX');
      expect(response.data.entries.every((e) => e.timestamp)).toBe(true);
      expect(response.data.entries.every((e) => e.eventType)).toBe(true);
      expect(response.data.entries.every((e) => e.content)).toBe(true);
    });
  });
});
