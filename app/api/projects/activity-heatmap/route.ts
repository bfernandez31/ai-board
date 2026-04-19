import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getActivityHeatmapData } from '@/lib/heatmap/queries';
import { VALID_AGENTS } from '@/lib/heatmap/types';

const querySchema = z.object({
  year: z
    .string()
    .refine(
      (val) => val === 'rolling' || /^\d{4}$/.test(val),
      { message: 'Year must be "rolling" or a 4-digit year' }
    )
    .default('rolling'),
  agent: z
    .enum(VALID_AGENTS)
    .default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const filters = querySchema.parse({
      year: searchParams.get('year') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const data = await getActivityHeatmapData(userId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
