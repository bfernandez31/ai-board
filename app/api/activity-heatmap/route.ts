import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getActivityHeatmapData } from '@/lib/activity-heatmap/queries';
import {
  HEATMAP_AGENT_FILTER_VALUES,
  HEATMAP_ROLLING_PERIOD,
} from '@/lib/activity-heatmap/types';
import { normalizePeriodValue } from '@/lib/activity-heatmap/period';

const querySchema = z.object({
  period: z.string().optional(),
  agent: z.enum(HEATMAP_AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUserOrToken(request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      period: searchParams.get('period') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const period = normalizePeriodValue(parsed.period ?? HEATMAP_ROLLING_PERIOD);

    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await getActivityHeatmapData({
      userId: user.id,
      userCreatedAt: userRow.createdAt,
      filters: { period, agent: parsed.agent },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid heatmap filters' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
