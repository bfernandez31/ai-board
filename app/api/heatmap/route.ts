import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/heatmap/types';

const querySchema = z.object({
  year: z.string().regex(/^(rolling|\d{4})$/).default('rolling'),
  agent: z.enum(HEATMAP_AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const filters = querySchema.parse({
      year: searchParams.get('year') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const data = await getHeatmapData(userId, filters);

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
    console.error('Heatmap API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
