import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/activity-heatmap/queries';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import type { HeatmapFilters } from '@/lib/activity-heatmap/types';

function buildQuerySchema() {
  return z.object({
    year: z
      .union([
        z.literal('rolling'),
        z.coerce.number().int().min(2020).max(new Date().getFullYear()),
      ])
      .default('rolling'),
    agent: z
      .union([z.literal('all'), z.enum(ALL_AGENTS as unknown as [string, ...string[]])])
      .default('all'),
  });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const raw = {
      year: searchParams.get('year') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    };

    const parsed = buildQuerySchema().safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const field = String(firstError?.path[0] ?? 'parameter');
      return NextResponse.json(
        { error: `Invalid ${field} parameter` },
        { status: 400 }
      );
    }

    const filters: HeatmapFilters = {
      year: parsed.data.year,
      agent: parsed.data.agent as HeatmapFilters['agent'],
    };

    const data = await getHeatmapData(userId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
