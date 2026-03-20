import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { buildComparisonSummary, comparisonWithEntriesInclude } from '@/lib/comparison/view-model';
import { resolveComparisonRouteParams } from './_utils';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: rawProjectId, id: rawTicketId } = await context.params;
    const routeParams = await resolveComparisonRouteParams(rawProjectId, rawTicketId);
    if (routeParams instanceof NextResponse) {
      return routeParams;
    }
    const { projectId, ticketId } = routeParams;

    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10;
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(parsedLimit, 50);

    const [comparisons, total] = await Promise.all([
      prisma.ticketComparison.findMany({
        where: {
          projectId,
          tickets: {
            some: { ticketId },
          },
        },
        include: comparisonWithEntriesInclude,
        orderBy: { generatedAt: 'desc' },
        take: limit,
      }),
      prisma.ticketComparison.count({
        where: {
          projectId,
          tickets: {
            some: { ticketId },
          },
        },
      }),
    ]);

    return NextResponse.json({
      comparisons: comparisons.map((comparison) =>
        buildComparisonSummary(comparison, ticketId)
      ),
      total,
      limit,
      offset: 0,
    });
  } catch (error) {
    console.error('Error listing comparisons:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
