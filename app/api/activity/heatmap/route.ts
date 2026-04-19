import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/analytics/heatmap-queries';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import type { HeatmapFilters } from '@/lib/analytics/heatmap-types';

const querySchema = z.object({
  period: z
    .union([z.literal('last12months'), z.string().regex(/^\d{4}$/)])
    .optional(),
  agent: z.enum(AGENT_FILTER_VALUES).optional(),
});

function buildFilters(raw: { period?: string | undefined; agent?: string | undefined }): HeatmapFilters {
  const agent = (raw.agent as HeatmapFilters['agent'] | undefined) ?? 'all';
  if (raw.period && raw.period !== 'last12months' && /^\d{4}$/.test(raw.period)) {
    const year = Number.parseInt(raw.period, 10);
    return {
      period: { kind: 'year', year },
      agent,
    };
  }
  return {
    period: { kind: 'rolling12m', endDate: '' },
    agent,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const rawParams = {
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    };

    const parsed = querySchema.safeParse(rawParams);
    const filters = parsed.success
      ? buildFilters(parsed.data)
      : buildFilters({});

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
