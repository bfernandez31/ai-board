import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getHeatmapData } from '@/lib/activity-heatmap/queries';
import { isValidAgentFilter, isValidPeriod } from '@/lib/activity-heatmap/aggregations';
import type { HeatmapAgentFilter, HeatmapPeriod } from '@/lib/activity-heatmap/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get('period');
    const rawAgent = searchParams.get('agent');

    const period: HeatmapPeriod | undefined =
      rawPeriod && isValidPeriod(rawPeriod) ? rawPeriod : undefined;
    const agent: HeatmapAgentFilter | undefined = isValidAgentFilter(rawAgent)
      ? rawAgent
      : undefined;

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const filters: { period?: HeatmapPeriod; agent?: HeatmapAgentFilter } = {};
    if (period !== undefined) filters.period = period;
    if (agent !== undefined) filters.agent = agent;

    const data = await getHeatmapData(user.id, userRecord.createdAt, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
