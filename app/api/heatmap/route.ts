import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import {
  DEFAULT_HEATMAP_FILTERS,
  isValidHeatmapAgent,
  isValidHeatmapPeriod,
} from '@/lib/heatmap/aggregations';
import type { HeatmapAgentFilter, HeatmapPeriod } from '@/lib/heatmap/types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get('period');
    const rawAgent = searchParams.get('agent');

    const period: HeatmapPeriod =
      rawPeriod && isValidHeatmapPeriod(rawPeriod) ? rawPeriod : DEFAULT_HEATMAP_FILTERS.period;
    const agent: HeatmapAgentFilter =
      rawAgent && isValidHeatmapAgent(rawAgent) ? rawAgent : DEFAULT_HEATMAP_FILTERS.agent;

    const data = await getHeatmapData(userId, user.createdAt, { period, agent });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
