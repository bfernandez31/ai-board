import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

export async function GET(
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
      await verifyProjectAccess(projectId, request);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Forbidden', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    const ticketsRemaining = await prisma.ticket.count({
      where: {
        projectId,
        stage: 'SHIP',
        outcome: { is: null },
      },
    });

    const progress = await prisma.backfillProgress.findUnique({
      where: { projectId },
    });

    if (!progress) {
      return NextResponse.json({
        status: 'NEVER_STARTED',
        ticketsRemaining,
      });
    }

    return NextResponse.json({
      status: progress.status,
      ticketsProcessed: progress.ticketsProcessed,
      ticketsRemaining,
      ticketsWithPartial: progress.ticketsWithPartial,
      lastProcessedTicketId: progress.lastProcessedTicketId,
      startedAt: progress.startedAt.toISOString(),
      updatedAt: progress.updatedAt.toISOString(),
      completedAt: progress.completedAt?.toISOString() ?? null,
      lastError: progress.lastError,
    });
  } catch (err) {
    console.error('[api/backfill-outcomes/status] error', err);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
