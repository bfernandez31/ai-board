import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getActivityHeatmapData } from '@/lib/heatmap/queries';
import { VALID_AGENTS } from '@/lib/heatmap/types';

const AUTH_ERROR_MESSAGES = new Set([
  'Unauthorized',
  'Invalid token',
  'Invalid token format',
  'Rate limit exceeded',
]);

const MIN_HEATMAP_YEAR = 1970;
const MAX_HEATMAP_YEAR = new Date().getFullYear();

const querySchema = z.object({
  year: z
    .string()
    .refine(
      (val) => {
        if (val === 'rolling') return true;
        if (!/^\d{4}$/.test(val)) return false;
        const yearNum = parseInt(val, 10);
        return yearNum >= MIN_HEATMAP_YEAR && yearNum <= MAX_HEATMAP_YEAR;
      },
      { message: `Year must be "rolling" or a 4-digit year between ${MIN_HEATMAP_YEAR} and ${MAX_HEATMAP_YEAR}` }
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
    if (error instanceof Error && AUTH_ERROR_MESSAGES.has(error.message)) {
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
