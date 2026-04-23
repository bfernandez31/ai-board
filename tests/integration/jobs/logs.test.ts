import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { waitForLatestJobId } from '@/tests/helpers/job-helpers';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

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
        description: 'Test ticket for execution log coverage',
      }
    );
    ticketId = createResponse.data.id;

    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    jobId = await waitForLatestJobId(prisma, ticketId);
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'FAILED' });
  });

  it('accepts workflow-authenticated uploads and returns member-scoped detail', async () => {
    const uploadResponse = await workflowApi.post(
      `/api/jobs/${jobId}/logs`,
      {
        agent: 'CODEX',
        sourceFormat: 'codex-runner-capture',
        availability: 'AVAILABLE',
        summary: {
          headline: 'Job failed while running the verification script.',
          status: 'FAILED',
          latestImportantEvents: [
            {
              timestamp: new Date().toISOString(),
              kind: 'ERROR',
              label: 'Verification script returned exit code 1',
            },
          ],
          errorReason: 'Verification script returned exit code 1',
          partial: false,
          unavailable: false,
          pruned: false,
          capturedEventCount: 2,
        },
        events: [
          {
            sequence: 0,
            timestamp: new Date().toISOString(),
            kind: 'STATUS',
            actor: 'system',
            title: 'Started verification',
            body: 'Running bun run lint',
            toolName: null,
            metadata: null,
          },
          {
            sequence: 1,
            timestamp: new Date().toISOString(),
            kind: 'ERROR',
            actor: 'system',
            title: 'Verification script returned exit code 1',
            body: 'Lint found one failing rule.',
            toolName: null,
            metadata: null,
          },
        ],
      }
    );

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.data.availability).toBe('AVAILABLE');

    const detailResponse = await ctx.api.get(
      `/api/projects/${ctx.projectId}/jobs/${jobId}/logs`
    );

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.data.jobId).toBe(jobId);
    expect(detailResponse.data.events).toHaveLength(2);
    expect(detailResponse.data.summary.headline).toContain('verification script');
  });

  it('preserves summary-only audit state for pruned logs', async () => {
    await prisma.jobExecutionLog.update({
      where: { jobId },
      data: {
        agent: 'CLAUDE',
        availability: 'PRUNED',
        sourceFormat: 'claude-runner-capture',
        summaryJson: {
          headline: 'Execution logs were pruned after retention.',
          status: 'FAILED',
          latestImportantEvents: [],
          errorReason: 'Retention window expired',
          partial: false,
          unavailable: false,
          pruned: true,
          capturedEventCount: 3,
        },
        eventCount: 3,
        artifactBytes: null,
        artifactEncoding: null,
        artifactSha256: null,
        artifactSizeBytes: null,
        capturedAt: new Date('2026-03-01T00:00:00.000Z'),
        retainedUntil: new Date('2026-04-01T00:00:00.000Z'),
        prunedAt: new Date('2026-04-05T00:00:00.000Z'),
      },
    });

    const response = await ctx.api.get(
      `/api/projects/${ctx.projectId}/jobs/${jobId}/logs`
    );

    expect(response.status).toBe(200);
    expect(response.data.availability).toBe('PRUNED');
    expect(response.data.events).toBeNull();
    expect(response.data.summary.pruned).toBe(true);
  });
});
