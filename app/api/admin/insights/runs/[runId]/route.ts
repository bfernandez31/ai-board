import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/db/admin-auth';
import { prisma } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await verifyAdminAccess(request);

    const { runId: runIdStr } = await params;
    const runId = parseInt(runIdStr, 10);

    if (isNaN(runId) || runId <= 0) {
      return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
    }

    const run = await prisma.insightsRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Not found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    console.error('[Admin Insights Run] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
