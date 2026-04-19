import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { isValidAgentFilter, parsePeriodFilter } from '@/lib/heatmap/aggregations';
import type { HeatmapAgentFilter } from '@/lib/heatmap/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const period = parsePeriodFilter(searchParams.get('period'));
    if (period === null) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const agentParam = searchParams.get('agent');
    let agent: HeatmapAgentFilter = 'all';
    if (agentParam !== null) {
      if (!isValidAgentFilter(agentParam)) {
        return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
      }
      agent = agentParam;
    }

    const data = await getHeatmapData(userId, { period, agent });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
