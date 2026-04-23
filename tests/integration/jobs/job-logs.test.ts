/**
 * Integration tests for job log capture + retrieval.
 *
 * Covers:
 *   POST /api/jobs/:id/logs                                       (workflow auth)
 *   GET  /api/projects/:projectId/tickets/:ticketId/jobs/:jobId/logs (user auth)
 *   GET  /api/projects/:projectId/tickets/:id/jobs                (log metadata mirror)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { waitForLatestJobId } from '@/tests/helpers/job-helpers';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN =
  process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
  });
}

describe('Job Log API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    const created = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Job Logs',
        description: 'Test ticket for log capture testing',
      }
    );
    ticketId = created.data.id;

    await ctx.api.post(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
      { targetStage: 'SPECIFY' }
    );
    jobId = await waitForLatestJobId(prisma, ticketId);
  });

  describe('POST /api/jobs/:id/logs', () => {
    it('accepts plain-text logs and mirrors the summary on Job.logs', async () => {
      const content = [
        'Starting agent run',
        'Invoking tool Read',
        'Finished ai-board.specify',
      ].join('\n');

      const response = await workflowApi.post<{
        id: number;
        jobId: number;
        truncated: boolean;
        byteSize: number;
        eventCount: number;
      }>(`/api/jobs/${jobId}/logs`, { content, agent: 'CLAUDE' });

      expect(response.status).toBe(200);
      expect(response.data.jobId).toBe(jobId);
      expect(response.data.truncated).toBe(false);
      expect(response.data.byteSize).toBe(content.length);

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { logs: true },
      });
      expect(job?.logs).toBeTruthy();
      expect(job?.logs).toContain('Finished ai-board.specify');
    });

    it('rejects requests without a workflow token', async () => {
      const response = await ctx.api.post<{ error: string }>(
        `/api/jobs/${jobId}/logs`,
        { content: 'x' }
      );
      expect(response.status).toBe(401);
    });

    it('returns 404 for unknown job ids', async () => {
      const response = await workflowApi.post<{ error: string }>(
        `/api/jobs/9999999/logs`,
        { content: 'x' }
      );
      expect(response.status).toBe(404);
    });

    it('normalizes Claude stream-json events into readable lines', async () => {
      const events = [
        JSON.stringify({
          type: 'assistant',
          timestamp: '2026-04-23T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Planning changes' }] },
        }),
        JSON.stringify({
          type: 'tool_use',
          timestamp: '2026-04-23T10:00:01Z',
          name: 'Edit',
        }),
      ].join('\n');

      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        content: events,
        agent: 'CLAUDE',
      });

      const stored = await prisma.jobLog.findUnique({ where: { jobId } });
      expect(stored).not.toBeNull();
      expect(stored!.content).toContain('assistant: Planning changes');
      expect(stored!.content).toContain('tool_use: Edit');
      expect(stored!.eventCount).toBe(2);
      expect(stored!.agent).toBe('CLAUDE');
    });

    it('is idempotent — repeated uploads replace the existing log', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, { content: 'first' });
      await workflowApi.post(`/api/jobs/${jobId}/logs`, { content: 'second upload' });

      const logs = await prisma.jobLog.findMany({ where: { jobId } });
      expect(logs).toHaveLength(1);
      expect(logs[0]!.content).toContain('second upload');
    });
  });

  describe('GET /api/projects/:projectId/tickets/:ticketId/jobs/:jobId/logs', () => {
    it('returns the captured log content for project members', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        content: 'step 1\nstep 2\nERROR: timeout reached',
        agent: 'CLAUDE',
      });

      const response = await ctx.api.get<{
        jobId: number;
        command: string;
        status: string;
        log: {
          content: string;
          summary: string | null;
          truncated: boolean;
          byteSize: number;
          eventCount: number;
          agent: string | null;
        };
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`);

      expect(response.status).toBe(200);
      expect(response.data.log.content).toContain('step 1');
      expect(response.data.log.content).toContain('ERROR: timeout reached');
      expect(response.data.log.summary).toContain('ERROR');
      expect(response.data.log.agent).toBe('CLAUDE');
    });

    it('returns 404 when no log has been captured yet', async () => {
      const response = await ctx.api.get<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`
      );
      expect(response.status).toBe(404);
      expect(response.data.code).toBe('LOG_NOT_FOUND');
    });

    it('rejects access to a job in a different project', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, { content: 'x' });
      const otherProjectId = ctx.projectId === 1 ? 2 : 1;

      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${otherProjectId}/tickets/${ticketId}/jobs/${jobId}/logs`
      );
      // Either 404 (not in project) or 403 (cross-project guard).
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/jobs (log metadata mirror)', () => {
    it('exposes logSummary + hasLog so the timeline can preview without a click', async () => {
      await workflowApi.post(`/api/jobs/${jobId}/logs`, {
        content: 'step 1\nstep 2\nall good',
        agent: 'CLAUDE',
      });

      const response = await ctx.api.get<
        Array<{
          id: number;
          hasLog: boolean;
          logSummary: string | null;
          logTruncated: boolean;
          logAgent: string | null;
        }>
      >(`/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs`);

      const job = response.data.find((j) => j.id === jobId);
      expect(job).toBeDefined();
      expect(job!.hasLog).toBe(true);
      expect(job!.logAgent).toBe('CLAUDE');
      expect(job!.logTruncated).toBe(false);
      expect(job!.logSummary).toContain('all good');
    });
  });
});
