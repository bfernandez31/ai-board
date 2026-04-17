import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getActivityHeatmapData } from '@/lib/activity-heatmap/queries';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/activity-heatmap/types';

const periodSchema = z
  .string()
  .regex(/^(last-12-months|\d{4})$/, 'Invalid period')
  .default('last-12-months');

const querySchema = z.object({
  period: periodSchema,
  agent: z.enum(HEATMAP_AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const filters = querySchema.parse({
      period: searchParams.get('period') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const data = await getActivityHeatmapData(userId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid activity heatmap filters' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
