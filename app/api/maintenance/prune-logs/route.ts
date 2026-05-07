import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { deleteJobLogArtifact, isConfigured } from '@/app/lib/blob/client';

const BATCH_SIZE = 500;
const CYCLE_LIMIT = 50_000;
const DEFAULT_RETENTION_DAYS = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyWorkflowToken(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const parsedRetentionDays = Number(process.env.LOG_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  const retentionDays = Number.isFinite(parsedRetentionDays)
    ? Math.max(1, parsedRetentionDays)
    : DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const blobConfigured = isConfigured();

  let prunedCount = 0;
  let skippedCount = 0;
  let processed = 0;

  try {
    while (processed < CYCLE_LIMIT) {
      const batch = await prisma.jobLog.findMany({
        where: {
          createdAt: { lt: cutoff },
          captureStatus: { not: 'PRUNED' },
        },
        select: { id: true, artifactKey: true, rawArtifactKey: true, jobId: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      processed += batch.length;

      const confirmedIds: number[] = [];
      for (const row of batch) {
        const keysToDelete = [row.artifactKey, row.rawArtifactKey].filter(Boolean) as string[];
        if (keysToDelete.length > 0) {
          if (!blobConfigured) {
            skippedCount += 1;
            continue;
          }
          let failed = false;
          for (const key of keysToDelete) {
            try {
              await deleteJobLogArtifact(key);
            } catch (error) {
              console.error('[prune-logs] Blob delete failed', key, error);
              failed = true;
              break;
            }
          }
          if (failed) {
            skippedCount += 1;
            continue;
          }
        }
        confirmedIds.push(row.id);
      }

      if (confirmedIds.length > 0) {
        // Mark the row as PRUNED rather than deleting it so the UI can still
        // show a "logs no longer retained" placeholder for old jobs.
        const result = await prisma.jobLog.updateMany({
          where: {
            id: { in: confirmedIds },
            captureStatus: { not: 'PRUNED' },
          },
          data: {
            captureStatus: 'PRUNED',
            artifactKey: null,
            artifactSize: null,
            rawArtifactKey: null,
            rawArtifactSize: null,
          },
        });
        prunedCount += result.count;
      }

      if (batch.length < BATCH_SIZE) break;
    }
  } catch (error) {
    console.error('[prune-logs] Unexpected error', error);
    return NextResponse.json(
      { error: 'Prune cycle failed', code: 'PRUNE_FAILED' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    prunedCount,
    skippedCount,
    durationMs: Date.now() - startedAt,
  });
}
