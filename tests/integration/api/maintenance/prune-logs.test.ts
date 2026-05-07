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

  it.skipIf(!blobConfigured)(
    'also clears nativeArtifactKey when pruning rows that have both artifacts',
    async () => {
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
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          captureStatus: 'CAPTURED',
          preview: 'aged-native',
          schemaVersion: 1,
          eventCount: 2,
          errorCount: 0,
          artifactKey: `logs/${ctx.projectId}/${ticketId}/${job.id}.jsonl.gz`,
          artifactSize: 100,
          nativeArtifactKey: `logs/${ctx.projectId}/${ticketId}/${job.id}.native.jsonl.gz`,
          nativeArtifactSize: 80,
          createdAt: cutoffDate,
        },
      });

      const res = await workflowApi().post<{ prunedCount: number }>(
        '/api/maintenance/prune-logs'
      );
      expect(res.status).toBe(200);
      expect(res.data.prunedCount).toBeGreaterThanOrEqual(1);

      const row = await prisma.jobLog.findUnique({ where: { jobId: job.id } });
      expect(row).not.toBeNull();
      expect(row?.captureStatus).toBe('PRUNED');
      expect(row?.artifactKey).toBeNull();
      expect(row?.artifactSize).toBeNull();
      expect(row?.nativeArtifactKey).toBeNull();
      expect(row?.nativeArtifactSize).toBeNull();
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
