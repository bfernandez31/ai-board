import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import { getHeatmapData } from '@/lib/activity/heatmap-queries';
import { buildYearOptions } from '@/lib/activity/heatmap-bucketing';
import type { HeatmapYearSelection } from '@/lib/activity/heatmap-types';

const querySchema = z.object({
  year: z.string().max(32).optional(),
  agent: z.enum(AGENT_FILTER_VALUES).default('all'),
  tz: z.string().max(64).optional(),
});

function resolveTimezone(tz: string | undefined): string {
  const candidate = tz && tz.length > 0 ? tz : 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const viewerId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      year: searchParams.get('year') || undefined,
      agent: searchParams.get('agent') || undefined,
      tz: searchParams.get('tz') || undefined,
    });

    const user = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { createdAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const yearOptions = buildYearOptions(user.createdAt, now);
    const validYears = new Set(yearOptions.map((o) => o.value));
    const rawYear = (parsed.year ?? 'last-12-months') as HeatmapYearSelection;
    if (!validYears.has(rawYear)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const timezone = resolveTimezone(parsed.tz);

    const data = await getHeatmapData(viewerId, user.createdAt, {
      year: rawYear,
      agent: parsed.agent,
      timezone,
    });

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
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
