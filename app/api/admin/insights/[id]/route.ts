import { NextRequest, NextResponse } from 'next/server';
import { AdminAccessDeniedError, requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/client';
import { fetchInsightsReportArtifact } from '@/app/lib/blob/client';

function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return notFound();
    }
    console.error('[GET /api/admin/insights/:id] Auth error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const { id: idString } = await context.params;
  const id = parseInt(idString, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const report = await prisma.insightsReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        sessionCount: true,
        ticketCount: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        artifactKey: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    let html: string | null = null;
    if (report.status === 'COMPLETED' && report.artifactKey) {
      try {
        html = await fetchInsightsReportArtifact(report.artifactKey);
      } catch (error) {
        console.error('[GET /api/admin/insights/:id] Blob fetch failed', error);
        return NextResponse.json(
          { error: 'Report artifact unavailable', code: 'BLOB_UNREACHABLE' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        report: {
          id: report.id,
          status: report.status,
          periodStart: report.periodStart?.toISOString() ?? null,
          periodEnd: report.periodEnd?.toISOString() ?? null,
          sessionCount: report.sessionCount,
          ticketCount: report.ticketCount,
          errorMessage: report.errorMessage,
          startedAt: report.startedAt.toISOString(),
          completedAt: report.completedAt?.toISOString() ?? null,
          html,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[GET /api/admin/insights/:id] Error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
