import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { prisma } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const [run, activeRun] = await Promise.all([
      prisma.insightsRun.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.insightsRun.findFirst({
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
          timeoutAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const responseRun = run
      ? {
          ...run,
          reportUrl: run.reportKey
            ? `/api/admin/insights/runs/${run.id}/report`
            : null,
        }
      : null;

    return NextResponse.json({ run: responseRun, activeRun });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights Latest] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
