import { NextRequest, NextResponse } from 'next/server';
import { getProjectActivityHeatmap, parseProjectActivityFilters } from '@/lib/projects/activity-heatmap';

export async function GET(request: NextRequest) {
  try {
    const filters = parseProjectActivityFilters({
      year: request.nextUrl.searchParams.get('year'),
      agent: request.nextUrl.searchParams.get('agent'),
    });

    if (!filters) {
      return NextResponse.json(
        { error: 'Invalid activity filter', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const heatmap = await getProjectActivityHeatmap(filters, { request });
    return NextResponse.json(heatmap);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    console.error('Failed to fetch projects activity heatmap:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project activity heatmap', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
