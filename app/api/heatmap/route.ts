import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { DEFAULT_HEATMAP_PERIOD, isValidHeatmapAgent, isValidHeatmapPeriod } from '@/lib/heatmap/types';
import type { HeatmapFilters } from '@/lib/heatmap/types';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const { searchParams } = request.nextUrl;

    const period = searchParams.get('period') ?? DEFAULT_HEATMAP_PERIOD;
    const agent = searchParams.get('agent') ?? 'all';

    if (!isValidHeatmapPeriod(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    if (!isValidHeatmapAgent(agent)) {
      return NextResponse.json({ error: 'Invalid agent filter' }, { status: 400 });
    }

    const filters: HeatmapFilters = { period, agent };
    const data = await getHeatmapData(user.id, filters);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[heatmap] Failed to fetch heatmap data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
