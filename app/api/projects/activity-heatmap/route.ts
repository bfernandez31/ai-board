import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapInitialData } from '@/lib/heatmap/queries';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import { parsePeriodParam } from '@/lib/heatmap/period';
import { prisma } from '@/lib/db/client';
import type { HeatmapFilters } from '@/lib/heatmap/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const querySchema = z.object({
  period: z.string().optional(),
  agent: z.enum(AGENT_FILTER_VALUES).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const joinYear = user?.createdAt.getUTCFullYear() ?? now.getUTCFullYear();

    const filters: HeatmapFilters = {
      period: parsePeriodParam(parsed.period ?? null, joinYear, now),
      agent: parsed.agent ?? 'all',
    };

    const data = await getHeatmapInitialData(userId, filters, now);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid heatmap filters' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
