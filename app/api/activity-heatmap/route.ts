import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActivityHeatmap } from '@/lib/activity-heatmap/queries';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/activity-heatmap/types';
import type { HeatmapPeriod } from '@/lib/activity-heatmap/types';

const periodSchema = z.union([
  z.literal('last-12-months'),
  z
    .string()
    .regex(/^\d{4}$/)
    .transform((value) => parseInt(value, 10)),
]);

const querySchema = z.object({
  period: periodSchema.default('last-12-months'),
  agent: z.enum(HEATMAP_AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

    const data = await getActivityHeatmap({
      filters: {
        period: parsed.period as HeatmapPeriod,
        agent: parsed.agent,
      },
      request,
    });

    return NextResponse.json(data);
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
