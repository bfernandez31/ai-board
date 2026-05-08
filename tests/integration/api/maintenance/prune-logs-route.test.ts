import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/maintenance/prune-logs/route';

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

const cutoffDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

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

function postPrune(): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/maintenance/prune-logs', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    }),
  ) as unknown as Promise<Response>;
}

describe('prune-logs raw-artifact extension (mocked Blob client)', () => {
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

    // Second cycle converges once raw delete succeeds.
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
