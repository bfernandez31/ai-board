import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { prisma } from '@/lib/db/client';
import { isConfigured } from '@/app/lib/blob/client';
import { buildEffectiveAgentWhere } from '@/lib/analytics/queries';
import { executeInsightsAnalysis } from '@/app/lib/insights/run-analysis';

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAdminAccess(request);

    if (!isConfigured()) {
      return NextResponse.json(
        { error: 'Blob storage is not configured', code: 'BLOB_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const activeRun = await prisma.insightsRun.findFirst({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
        timeoutAt: { gt: new Date() },
      },
    });

    if (activeRun) {
      return NextResponse.json(
        { error: 'An analysis is already in progress', code: 'RUN_IN_PROGRESS' },
        { status: 409 }
      );
    }

    const lastCompleted = await prisma.insightsRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { periodEnd: true },
    });

    const since = lastCompleted?.periodEnd ?? new Date(0);
    const agentWhere = buildEffectiveAgentWhere('CLAUDE');

    const shippedTicketCount = await prisma.ticket.count({
      where: {
        stage: 'SHIP',
        updatedAt: { gt: since },
        ...agentWhere,
      },
    });

    if (shippedTicketCount === 0) {
      return NextResponse.json(
        {
          error: 'No new shipped tickets since last run',
          code: 'NO_NEW_TICKETS',
          lastRunDate: since.toISOString(),
        },
        { status: 409 }
      );
    }

    const timeoutAt = new Date(Date.now() + 30 * 60 * 1000);

    const run = await prisma.insightsRun.create({
      data: {
        triggeredBy: userId,
        timeoutAt,
      },
    });

    executeInsightsAnalysis(run.id).catch((err) => {
      console.error('[Admin Insights] Background analysis failed:', err);
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights Trigger] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const { searchParams } = new URL(request.url);
    const parsed = listSchema.safeParse({
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      status: searchParams.get('status') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid filters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { limit, cursor, status } = parsed.data;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (cursor) where.id = { lt: cursor };

    const runs = await prisma.insightsRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = runs.length > limit;
    const results = hasMore ? runs.slice(0, limit) : runs;
    const lastResult = results[results.length - 1];
    const nextCursor = hasMore && lastResult ? lastResult.id : null;

    return NextResponse.json({ runs: results, nextCursor, hasMore });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights List] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
