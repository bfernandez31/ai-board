import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import type { HeatmapFilters } from '@/lib/heatmap/types';

function parseFilters(searchParams: URLSearchParams): HeatmapFilters {
  const yearParam = searchParams.get('year') ?? 'rolling';
  const agentParam = searchParams.get('agent') ?? 'all';

  // Validate year: "rolling" or 4-digit year
  const year = yearParam === 'rolling' || /^\d{4}$/.test(yearParam) ? yearParam : 'rolling';

  // Validate agent
  const agent = AGENT_FILTER_VALUES.includes(agentParam as (typeof AGENT_FILTER_VALUES)[number])
    ? (agentParam as (typeof AGENT_FILTER_VALUES)[number])
    : 'all';

  return { year, agent };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const filters = parseFilters(request.nextUrl.searchParams);
    const data = await getHeatmapData(userId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
