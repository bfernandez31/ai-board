import { NextRequest, NextResponse } from 'next/server';
import { getProjectsActivityHeatmapData } from '@/lib/projects/activity-heatmap';

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
    if (error instanceof Error) {
      if (error.message === 'Invalid heatmap filters') {
        return NextResponse.json({ error: 'Invalid heatmap filters' }, { status: 400 });
      }

      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    console.error('Projects activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
