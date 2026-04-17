import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import {
  getHeatmapData,
  type HeatmapAgentFilter,
  type HeatmapPeriod,
} from '@/lib/analytics/activity-heatmap';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

const agentValues = ['all', ...ALL_AGENTS] as const;

const querySchema = z.object({
  y: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || value === '12m' || /^\d{4}$/.test(value),
      { message: 'Invalid year' }
    ),
  a: z.enum(agentValues).optional(),
  tz: z.string().optional(),
});

function parsePeriod(value: string | undefined, now: Date, userCreatedYear: number): HeatmapPeriod {
  if (!value || value === '12m') return { kind: 'rolling12m' };
  const year = parseInt(value, 10);
  const currentYear = now.getUTCFullYear();
  if (!Number.isFinite(year) || year < userCreatedYear || year > currentYear) {
    return { kind: 'rolling12m' };
  }
  return { kind: 'calendarYear', year };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      y: searchParams.get('y') || undefined,
      a: searchParams.get('a') || undefined,
      tz: searchParams.get('tz') || undefined,
    });

    const now = new Date();
    const { prisma } = await import('@/lib/db/client');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const userCreatedYear = (user?.createdAt ?? now).getUTCFullYear();

    const period = parsePeriod(parsed.y, now, userCreatedYear);
    const agent: HeatmapAgentFilter = (parsed.a ?? 'all') as HeatmapAgentFilter;
    const tz = parsed.tz ?? 'UTC';

    const data = await getHeatmapData({ userId, period, agent, tz, now });
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
