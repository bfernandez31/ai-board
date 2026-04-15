import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getHeatmapData } from '@/lib/heatmap/queries';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

const querySchema = z.object({
  year: z
    .string()
    .refine(
      (val) => val === 'rolling' || /^\d{4}$/.test(val),
      { message: 'Invalid year parameter' }
    )
    .default('rolling'),
  agent: z
    .string()
    .refine(
      (val) => val === 'all' || (ALL_AGENTS as readonly string[]).includes(val),
      { message: 'Invalid agent parameter' }
    )
    .default('all'),
});

export async function GET(request: Request) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const parseResult = querySchema.safeParse({
      year: searchParams.get('year') ?? 'rolling',
      agent: searchParams.get('agent') ?? 'all',
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message ?? 'Invalid parameters';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { year, agent } = parseResult.data;
    const data = await getHeatmapData(userId, { year, agent });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch heatmap data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data' },
      { status: 500 }
    );
  }
}
