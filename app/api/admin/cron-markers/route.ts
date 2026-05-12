import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { CRITICAL_CRONS } from '@/app/lib/admin/home/alerts';

export const dynamic = 'force-dynamic';

const cronMarkerSchema = z.object({
  workflowName: z.enum(CRITICAL_CRONS),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  runUrl: z.string().url().max(500).optional(),
});

const PRUNE_RETENTION_MS = 7 * 86_400_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyWorkflowToken(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_FAILED', details: [] },
      { status: 400 }
    );
  }

  const parsed = cronMarkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        code: 'VALIDATION_FAILED',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  let created;
  try {
    created = await prisma.cronRunLog.create({
      data: {
        workflowName: parsed.data.workflowName,
        durationMs: parsed.data.durationMs ?? null,
        runUrl: parsed.data.runUrl ?? null,
      },
      select: { id: true, ranAt: true },
    });
  } catch (error) {
    console.error('[cron-markers] Failed to record marker', error);
    return NextResponse.json(
      { error: 'Failed to record cron marker', code: 'MARKER_WRITE_FAILED' },
      { status: 500 }
    );
  }

  // Lazy prune older rows; failure is non-fatal.
  const cutoff = new Date(Date.now() - PRUNE_RETENTION_MS);
  prisma.cronRunLog
    .deleteMany({ where: { ranAt: { lt: cutoff } } })
    .catch((err: unknown) => {
      console.error('[cron-markers] Prune failed', err);
    });

  return NextResponse.json(
    { id: created.id, ranAt: created.ranAt.toISOString() },
    { status: 201 }
  );
}
