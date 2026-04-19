import { NextRequest, NextResponse } from 'next/server';
import { getProjectsActivityHeatmapData } from '@/lib/projects/activity-heatmap';

function buildErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) {
    return null;
  }

  switch (error.message) {
    case 'Invalid heatmap filters':
      return NextResponse.json({ error: 'Invalid heatmap filters' }, { status: 400 });
    case 'Unauthorized':
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    default:
      return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getProjectsActivityHeatmapData(
      {
        period: searchParams.get('period'),
        agent: searchParams.get('agent'),
      },
      {
        request,
        strict: true,
      }
    );

    return NextResponse.json(data);
  } catch (error) {
    const errorResponse = buildErrorResponse(error);
    if (errorResponse) {
      return errorResponse;
    }

    console.error('Projects activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
