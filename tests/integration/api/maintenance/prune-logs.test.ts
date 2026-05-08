import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const { deleteJobLogArtifact, isConfigured, verifyWorkflowToken } = vi.hoisted(() => ({
  deleteJobLogArtifact: vi.fn(),
  isConfigured: vi.fn(),
  verifyWorkflowToken: vi.fn(),
}));

vi.mock('@/app/lib/blob/client', () => ({
  deleteJobLogArtifact,
  isConfigured,
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  verifyWorkflowToken,
}));

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function workflowApi(): APIClient {
  return createAPIClient({
    defaultHeaders: { Authorization: `Bearer ${WORKFLOW_TOKEN}` },
    includeTestUserHeader: false,
    enableTestAuthOverride: false,
  });
}

describe('POST /api/maintenance/prune-logs', () => {
  let ctx: TestContext;
  let ticketId: number;
  const prisma = getPrismaClient();
  const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] prune' });
    ticketId = ticket.id;
  });

  async function seedAged(jobCount: number): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 0; i < jobCount; i++) {
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
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          captureStatus: 'CAPTURED',
          preview: `aged-${i}`,
          schemaVersion: 1,
          eventCount: 1,
          errorCount: 0,
          artifactKey: `logs/${ctx.projectId}/${ticketId}/${job.id}.jsonl.gz`,
          artifactSize: 100,
          createdAt: cutoffDate,
        },
      });
      ids.push(job.id);
    }
    return ids;
  }

  it('returns 401 when Authorization header is missing', async () => {
    const unauth = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const res = await unauth.post('/api/maintenance/prune-logs');
    expect(res.status).toBe(401);
  });

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  it.skipIf(!blobConfigured)(
    'marks aged rows PRUNED (not deleted) and reports the count; second run is a no-op',
    async () => {
      const ids = await seedAged(3);
      const first = await workflowApi().post<{ prunedCount: number; skippedCount: number }>(
        '/api/maintenance/prune-logs'
      );
      expect(first.status).toBe(200);
      expect(first.data.prunedCount).toBeGreaterThanOrEqual(3);

      const remaining = await prisma.jobLog.findMany({
        where: { jobId: { in: ids } },
      });
      expect(remaining.length).toBeGreaterThanOrEqual(3);
      for (const row of remaining) {
        expect(row.captureStatus).toBe('PRUNED');
        expect(row.artifactKey).toBeNull();
        expect(row.artifactSize).toBeNull();
      }

      const second = await workflowApi().post<{ prunedCount: number }>(
        '/api/maintenance/prune-logs'
      );
      expect(second.status).toBe(200);
      expect(second.data.prunedCount).toBe(0);
    }
  );

  it.skipIf(blobConfigured)(
    'skips rows with artifactKey when Blob is unconfigured (avoids orphan leak)',
    async () => {
      const ids = await seedAged(2);
      const res = await workflowApi().post<{ prunedCount: number; skippedCount: number }>(
        '/api/maintenance/prune-logs'
      );
      expect(res.status).toBe(200);
      expect(res.data.prunedCount).toBe(0);
      expect(res.data.skippedCount).toBeGreaterThanOrEqual(2);

      const remaining = await prisma.jobLog.findMany({ where: { jobId: { in: ids } } });
      expect(remaining.length).toBe(2);
      for (const row of remaining) {
        expect(row.captureStatus).toBe('CAPTURED');
      }
    }
  );

  it('marks aged row without artifactKey as PRUNED regardless of Blob config', async () => {
    // Rows without artifactKey (e.g. UNAVAILABLE captures) have no Blob object
    // to clean up, so pruning works even when BLOB_READ_WRITE_TOKEN is unset.
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
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'UNAVAILABLE',
        preview: 'aged-unavailable',
        schemaVersion: 1,
        eventCount: 0,
        errorCount: 0,
        createdAt: cutoffDate,
      },
    });

    const res = await workflowApi().post<{ prunedCount: number }>('/api/maintenance/prune-logs');
    expect(res.status).toBe(200);
    expect(res.data.prunedCount).toBeGreaterThanOrEqual(1);

    const row = await prisma.jobLog.findUnique({ where: { jobId: job.id } });
    expect(row).not.toBeNull();
    expect(row?.captureStatus).toBe('PRUNED');
  });
});

// Direct POST() invocation with mocked Blob client. Lets us assert the
// raw-artifact extension's call ordering and skipped-row semantics regardless
// of whether BLOB_READ_WRITE_TOKEN is set in the environment.
describe('prune-logs raw-artifact extension (mocked Blob client)', () => {
  const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

  async function loadRouteHandler() {
    const mod = await import('@/app/api/maintenance/prune-logs/route');
    return mod.POST;
  }

  async function seedRowWithBothKeys(
    ctx: TestContext,
    ticketId: number,
  ): Promise<{ jobId: number; artifactKey: string; rawArtifactKey: string }> {
    const prisma = getPrismaClient();
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
    const artifactKey = `logs/${ctx.projectId}/${ticketId}/${job.id}.jsonl.gz`;
    const rawArtifactKey = `raw-logs/${ctx.projectId}/${ticketId}/${job.id}.jsonl.gz`;
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: 'aged-both',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey,
        artifactSize: 100,
        rawArtifactKey,
        rawArtifactSize: 200,
        createdAt: cutoffDate,
      },
    });
    return { jobId: job.id, artifactKey, rawArtifactKey };
  }

  async function postPrune(): Promise<Response> {
    const POST = await loadRouteHandler();
    return POST(
      new NextRequest('http://localhost/api/maintenance/prune-logs', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      }),
    ) as unknown as Promise<Response>;
  }

  let ctx: TestContext;
  let ticketId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    deleteJobLogArtifact.mockReset();
    isConfigured.mockReset();
    verifyWorkflowToken.mockReset();
    verifyWorkflowToken.mockResolvedValue(true);
    isConfigured.mockReturnValue(true);
    deleteJobLogArtifact.mockResolvedValue({ deleted: true });
    const ticket = await ctx.createTicket({ title: '[e2e] prune-route' });
    ticketId = ticket.id;
  });

  it('deletes both Blob keys in the same iteration and clears all four columns', async () => {
    const { jobId, artifactKey, rawArtifactKey } = await seedRowWithBothKeys(ctx, ticketId);

    const res = await postPrune();
    expect(res.status).toBe(200);

    expect(deleteJobLogArtifact).toHaveBeenCalledWith(artifactKey);
    expect(deleteJobLogArtifact).toHaveBeenCalledWith(rawArtifactKey);
    const callKeys = deleteJobLogArtifact.mock.calls.map((c) => c[0] as string);
    expect(callKeys.indexOf(artifactKey)).toBeLessThan(callKeys.indexOf(rawArtifactKey));

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.captureStatus).toBe('PRUNED');
    expect(row.artifactKey).toBeNull();
    expect(row.artifactSize).toBeNull();
    expect(row.rawArtifactKey).toBeNull();
    expect(row.rawArtifactSize).toBeNull();
  });

  it('keeps the row unpruned and increments skippedCount when raw delete throws', async () => {
    const { jobId, artifactKey, rawArtifactKey } = await seedRowWithBothKeys(ctx, ticketId);
    deleteJobLogArtifact.mockImplementation(async (k: string) => {
      if (k === rawArtifactKey) throw new Error('raw blob unreachable');
      return { deleted: true };
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await postPrune();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { prunedCount: number; skippedCount: number };
    expect(data.prunedCount).toBe(0);
    expect(data.skippedCount).toBeGreaterThanOrEqual(1);

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.captureStatus).toBe('CAPTURED');
    expect(row.artifactKey).toBe(artifactKey);
    expect(row.rawArtifactKey).toBe(rawArtifactKey);

    deleteJobLogArtifact.mockReset();
    deleteJobLogArtifact.mockResolvedValue({ deleted: true });
    const res2 = await postPrune();
    expect(res2.status).toBe(200);
    const row2 = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row2.captureStatus).toBe('PRUNED');
    expect(row2.artifactKey).toBeNull();
    expect(row2.rawArtifactKey).toBeNull();

    errorSpy.mockRestore();
  });

  it('treats Blob 404 on raw key as success ({ deleted: false }) and prunes the row', async () => {
    const { jobId, rawArtifactKey } = await seedRowWithBothKeys(ctx, ticketId);
    deleteJobLogArtifact.mockImplementation(async (k: string) => {
      if (k === rawArtifactKey) return { deleted: false };
      return { deleted: true };
    });

    const res = await postPrune();
    expect(res.status).toBe(200);

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.captureStatus).toBe('PRUNED');
    expect(row.rawArtifactKey).toBeNull();
  });

  it('preserves existing behavior for pre-AIB-783 rows with only normalized artifactKey', async () => {
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
    const artifactKey = `logs/${ctx.projectId}/${ticketId}/${job.id}.jsonl.gz`;
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: 'aged-normalized-only',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey,
        artifactSize: 100,
        createdAt: cutoffDate,
      },
    });

    const res = await postPrune();
    expect(res.status).toBe(200);

    expect(deleteJobLogArtifact).toHaveBeenCalledWith(artifactKey);
    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId: job.id } });
    expect(row.captureStatus).toBe('PRUNED');
    expect(row.artifactKey).toBeNull();
    expect(row.rawArtifactKey).toBeNull();
  });
});
