import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { prisma } from '@/lib/db/client';
import { streamInsightsReport } from '@/app/lib/blob/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await verifyAdminAccess(request);

    const { runId: runIdStr } = await params;
    const runId = parseInt(runIdStr, 10);

    if (isNaN(runId) || runId <= 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const run = await prisma.insightsRun.findUnique({
      where: { id: runId },
      select: { reportKey: true },
    });

    if (!run || !run.reportKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await streamInsightsReport(run.reportKey);
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(result.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights Report] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
