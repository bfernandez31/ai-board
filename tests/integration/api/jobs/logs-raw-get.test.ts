import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] log-raw' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('returns 404 when no log row or artifactKey exists', async () => {
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'UNAVAILABLE',
        preview: 'Logs unavailable — capture failed.',
        schemaVersion: 1,
      },
    });
    const res = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`
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
        },
      });
      const withFormat = await ctx.api.fetch(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?format=jsonl`
      );
      expect(withFormat.status).toBe(200);
      const disposition = withFormat.headers.get('content-disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toMatch(/\.jsonl\.gz/);
    }
  );

  it.skipIf(blobConfigured)(
    'returns 502 when Blob is not configured for CAPTURED artifacts',
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
        },
      });
      const res = await ctx.api.fetch(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?format=jsonl`
      );
      expect(res.status).toBe(502);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('BLOB_UNREACHABLE');
    }
  );

  it('returns 404 for ?type=native when no rawArtifactKey exists', async () => {
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
      },
    });
    const res = await ctx.api.fetch(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?type=native`
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when no session cookie or test user override is provided', async () => {
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
      },
    });
    const unauthorized = await fetch(
      `${process.env.TEST_BASE_URL ?? 'http://localhost:3000'}/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`
    );
    expect(unauthorized.status).toBe(401);
  });
});
