import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function workflowApi(): APIClient {
  return createAPIClient({
    defaultHeaders: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
    includeTestUserHeader: false,
    enableTestAuthOverride: false,
  });
}

describe('POST /api/jobs/:id/logs', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    const ticket = await ctx.createTicket({ title: '[e2e] log-post' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const unauth = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const res = await unauth.post(`/api/jobs/${jobId}/logs`, {
      captureStatus: 'CAPTURED',
      preview: 'ok',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
      artifactSize: 100,
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization token is invalid', async () => {
    const bad = createAPIClient({
      defaultHeaders: { Authorization: 'Bearer not-a-real-token' },
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });
    const res = await bad.post(`/api/jobs/${jobId}/logs`, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when payload fails Zod validation', async () => {
    const res = await workflowApi().post<{ error: string }>(`/api/jobs/${jobId}/logs`, {
      captureStatus: 'CAPTURED',
      preview: '',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toBeTruthy();
  });

  it('rejects artifactKey when captureStatus is UNAVAILABLE', async () => {
    const res = await workflowApi().post<{ error: string }>(`/api/jobs/${jobId}/logs`, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
      artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
      artifactSize: 100,
    });
    expect(res.status).toBe(400);
  });

  it('upserts the JobLog row idempotently', async () => {
    const body = {
      captureStatus: 'CAPTURED' as const,
      preview: 'first preview',
      schemaVersion: 1,
      eventCount: 5,
      errorCount: 0,
      artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
      artifactSize: 1234,
    };
    const first = await workflowApi().post(`/api/jobs/${jobId}/logs`, body);
    expect(first.status).toBe(200);
    const second = await workflowApi().post(`/api/jobs/${jobId}/logs`, {
      ...body,
      preview: 'second preview',
      eventCount: 6,
    });
    expect(second.status).toBe(200);

    const rows = await prisma.jobLog.findMany({ where: { jobId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.preview).toBe('second preview');
    expect(rows[0]?.eventCount).toBe(6);
  });

  it('returns 404 for unknown job', async () => {
    const res = await workflowApi().post(`/api/jobs/9999999/logs`, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
    });
    expect(res.status).toBe(404);
  });
});
