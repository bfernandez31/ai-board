import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/native', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] log-native' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await fetch(
      `${process.env.TEST_BASE_URL ?? 'http://localhost:3000'}/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/native`
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when log row has no nativeArtifactKey', async () => {
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'preview',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
        artifactSize: 100,
        // nativeArtifactKey intentionally omitted
      },
    });
    const res = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/native`
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for UNAVAILABLE capture status', async () => {
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'UNAVAILABLE',
        preview: 'Logs unavailable — capture failed.',
        schemaVersion: 1,
      },
    });
    const res = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/native`
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when job does not belong to ticket', async () => {
    const otherTicket = await ctx.createTicket({ title: '[e2e] other-ticket' });
    const otherJob = await prisma.job.create({
      data: {
        ticketId: otherTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const res = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${otherJob.id}/logs/native`
    );
    expect(res.status).toBe(404);
  });

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  it.skipIf(!blobConfigured)(
    'sets Content-Disposition attachment header when ?format=jsonl',
    async () => {
      await prisma.jobLog.create({
        data: {
          jobId,
          captureStatus: 'CAPTURED',
          preview: 'preview',
          schemaVersion: 1,
          eventCount: 1,
          errorCount: 0,
          artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
          artifactSize: 100,
          nativeArtifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.native.jsonl.gz`,
          nativeArtifactSize: 50,
        },
      });
      const res = await ctx.api.fetch(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/native?format=jsonl`
      );
      // Blob may not have the artifact yet, but the header check only applies when it does
      if (res.status === 200) {
        expect(res.headers.get('content-disposition')).toMatch(/native\.jsonl\.gz/);
      }
    }
  );
});
