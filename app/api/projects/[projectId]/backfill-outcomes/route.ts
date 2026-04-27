import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { dispatchBackfillOutcomes } from '@/lib/workflows/dispatch-backfill-outcomes';

const bodySchema = z
  .object({
    resume: z.boolean().optional(),
  })
  .default({});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    try {
      await verifyProjectOwnership(projectId, request);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Project owner only', code: 'OWNERSHIP_REQUIRED' },
        { status: 403 }
      );
    }

    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      raw = {};
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const resume = parsed.data.resume ?? true;

    const existing = await prisma.backfillProgress.findUnique({
      where: { projectId },
    });

    if (existing && existing.status === 'IN_PROGRESS') {
      return NextResponse.json(
        {
          error: 'Backfill already in progress for this project',
          code: 'BACKFILL_IN_PROGRESS',
        },
        { status: 409 }
      );
    }

    const now = new Date();
    let progress;
    if (!existing) {
      progress = await prisma.backfillProgress.create({
        data: { projectId, status: 'IN_PROGRESS', startedAt: now },
      });
    } else {
      const updateData: Prisma.BackfillProgressUpdateManyMutationInput =
        resume === false
          ? {
              status: 'IN_PROGRESS',
              lastProcessedTicketId: null,
              ticketsProcessed: 0,
              ticketsWithPartial: 0,
              startedAt: now,
              completedAt: null,
              lastError: null,
              version: { increment: 1 },
            }
          : {
              status: 'IN_PROGRESS',
              lastError: null,
              completedAt: null,
              version: { increment: 1 },
            };

      const result = await prisma.backfillProgress.updateMany({
        where: { projectId, version: existing.version },
        data: updateData,
      });
      if (result.count === 0) {
        return NextResponse.json(
          {
            error: 'Backfill state changed concurrently',
            code: 'BACKFILL_IN_PROGRESS',
          },
          { status: 409 }
        );
      }
      progress = await prisma.backfillProgress.findUnique({ where: { projectId } });
    }

    let dispatchResult;
    try {
      dispatchResult = await dispatchBackfillOutcomes({
        projectId,
        resumeCursor: progress?.lastProcessedTicketId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dispatch failed';
      await prisma.backfillProgress.update({
        where: { projectId },
        data: {
          status: 'FAILED',
          lastError: message.substring(0, 2000),
        },
      });
      return NextResponse.json(
        { error: 'Backfill dispatch failed', code: 'BACKFILL_DISPATCH_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        projectId,
        status: progress?.status ?? 'IN_PROGRESS',
        startedAt: (progress?.startedAt ?? now).toISOString(),
        workflowRunUrl: dispatchResult.workflowRunUrl,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[api/backfill-outcomes] error', err);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
