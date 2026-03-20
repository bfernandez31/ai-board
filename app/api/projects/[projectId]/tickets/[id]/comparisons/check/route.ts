import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { buildComparisonCheckResult } from '@/lib/comparison/view-model';
import { resolveComparisonRouteParams } from '../_utils';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: rawProjectId, id: rawTicketId } = await context.params;
    const routeParams = await resolveComparisonRouteParams(rawProjectId, rawTicketId);
    if (routeParams instanceof NextResponse) {
      return routeParams;
    }
    const { projectId, ticketId } = routeParams;

    const comparisons = await prisma.ticketComparison.findMany({
      where: {
        projectId,
        tickets: {
          some: { ticketId },
        },
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        reportFilename: true,
      },
    });

    return NextResponse.json(buildComparisonCheckResult(comparisons));
  } catch (error) {
    console.error('Error checking comparisons:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
