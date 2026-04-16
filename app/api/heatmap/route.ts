import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

const querySchema = z.object({
  period: z
    .string()
    .regex(/^(last-12-months|\d{4})$/)
    .catch('last-12-months'),
  agent: z.enum(['all', ...ALL_AGENTS]).catch('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const filters = querySchema.parse({
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

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
