import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { parseReportFilename } from '@/lib/comparison/comparison-generator';
import { buildComparisonDetail, comparisonWithEntriesInclude } from '@/lib/comparison/view-model';
import { resolveComparisonRouteParams } from '../_utils';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; filename: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: rawProjectId, id: rawTicketId, filename } = await context.params;
    const routeParams = await resolveComparisonRouteParams(rawProjectId, rawTicketId);
    if (routeParams instanceof NextResponse) {
      return routeParams;
    }
    const { projectId, ticketId } = routeParams;

    if (!parseReportFilename(filename)) {
      return NextResponse.json(
        {
          error: 'Invalid filename format',
          code: 'VALIDATION_ERROR',
          message: 'Expected format: YYYYMMDD-HHMMSS-vs-KEYS.md',
        },
        { status: 400 }
      );
    }

    const comparison = await prisma.ticketComparison.findFirst({
      where: {
        projectId,
        reportFilename: filename,
        tickets: {
          some: { ticketId },
        },
      },
      include: comparisonWithEntriesInclude,
    });

    if (!comparison) {
      return NextResponse.json(
        {
          error: 'Comparison report not found',
          code: 'REPORT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      comparison: buildComparisonDetail(comparison),
    });
  } catch (error) {
    console.error('Error fetching comparison report:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
