import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getHeatmapData } from '@/lib/activity-heatmap/queries';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  period: z
    .string()
    .refine((v) => v === 'last-12-months' || /^\d{4}$/.test(v), {
      message: 'period must be "last-12-months" or a 4-digit year',
    })
    .default('last-12-months'),
  agent: z.enum(AGENT_FILTER_VALUES).default('all'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const filters = querySchema.parse({
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

    const data = await getHeatmapData(userId, user.createdAt, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid heatmap filters' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Activity heatmap API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
