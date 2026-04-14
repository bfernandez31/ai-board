import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import type { HeatmapFilters } from '@/lib/heatmap/types';

const heatmapQuerySchema = z.object({
  year: z.union([
    z.literal('rolling'),
    z.string().regex(/^\d{4}$/).transform(Number),
  ]).default('rolling'),
  agent: z.enum(AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const parsed = heatmapQuerySchema.parse({
      year: searchParams.get('year') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const filters: HeatmapFilters = {
      year: parsed.year,
      agent: parsed.agent,
    };

    const data = await getHeatmapData(userId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid heatmap filters' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
