import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildJobLogArtifactKey,
  buildJobLogRawArtifactKey,
} from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/jobs/[id]/logs/route';

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

describe('POST /api/jobs/:id/logs raw artifact persistence (AIB-776)', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    const ticket = await ctx.createTicket({ title: '[e2e] log-post-raw' });
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

  async function postLog(body: unknown): Promise<Response> {
    return POST(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: String(jobId) }) }
    );
  }

  it('persists raw artifact fields and returns rawNativeUrl when both provided', async () => {
    const artifactKey = buildJobLogArtifactKey(ctx.projectId, ticketId, jobId);
    const rawArtifactKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);

    const res = await postLog({
      captureStatus: 'CAPTURED',
      preview: 'ok',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey,
      artifactSize: 100,
      rawArtifactKey,
      rawArtifactSize: 250,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.rawNativeUrl).toBe(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw-native`
    );
    expect(json.rawArtifactSize).toBe(250);

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.rawArtifactKey).toBe(rawArtifactKey);
    expect(row.rawArtifactSize).toBe(250);
  });

  it('omits rawNativeUrl when no raw artifact is recorded', async () => {
    const artifactKey = buildJobLogArtifactKey(ctx.projectId, ticketId, jobId);
    const res = await postLog({
      captureStatus: 'CAPTURED',
      preview: 'ok',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey,
      artifactSize: 100,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.rawNativeUrl).toBeNull();

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.rawArtifactKey).toBeNull();
    expect(row.rawArtifactSize).toBeNull();
  });

  it('rejects rawArtifactKey without rawArtifactSize', async () => {
    const res = await postLog({
      captureStatus: 'CAPTURED',
      preview: 'ok',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: buildJobLogArtifactKey(ctx.projectId, ticketId, jobId),
      artifactSize: 100,
      rawArtifactKey: buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId),
    });
    expect(res.status).toBe(400);
  });
});
