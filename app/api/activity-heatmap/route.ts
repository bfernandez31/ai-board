import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { getActivityHeatmap } from '@/lib/analytics/heatmap-queries';
import {
  HEATMAP_AGENT_FILTER_VALUES,
  type HeatmapAgentFilter,
  type HeatmapFilters,
  type HeatmapPeriod,
} from '@/lib/analytics/heatmap-types';

const querySchema = z.object({
  period: z.string().optional(),
  agent: z.enum(HEATMAP_AGENT_FILTER_VALUES).optional(),
  tz: z.string().optional(),
});

function coerceTimezone(raw: string | undefined): string {
  if (!raw) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: raw });
    return raw;
  } catch {
    return 'UTC';
  }
}

function coercePeriod(
  raw: string | undefined,
  allowedYears: number[]
): HeatmapPeriod {
  if (!raw || raw === 'last-12-months') {
    return { kind: 'last-12-months' };
  }
  const asInt = Number.parseInt(raw, 10);
  if (!Number.isInteger(asInt) || !allowedYears.includes(asInt)) {
    return { kind: 'last-12-months' };
  }
  return { kind: 'calendar-year', year: asInt };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    userId = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get('period') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
      tz: searchParams.get('tz') ?? undefined,
    });
    const { agent: rawAgent, tz: rawTz, period: rawPeriod } = parsed.success
      ? parsed.data
      : {};

    const agent: HeatmapAgentFilter = rawAgent ?? 'all';
    const timezone = coerceTimezone(rawTz);

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const startYear = (user?.createdAt ?? now).getFullYear();
    const currentYear = now.getFullYear();
    const allowedYears: number[] = [];
    for (let y = startYear; y <= currentYear; y += 1) {
      allowedYears.push(y);
    }

    const period = coercePeriod(rawPeriod, allowedYears);
    const filters: HeatmapFilters = { period, agent, timezone };

    const payload = await getActivityHeatmap({ userId, filters, now });

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Activity heatmap API error:', error);
    return NextResponse.json(
      { error: 'Failed to load activity heatmap' },
      { status: 500 }
    );
  }
}
