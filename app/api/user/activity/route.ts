import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import {
  getUserHeatmapData,
  type AgentFilter,
  type HeatmapPeriod,
} from '@/lib/analytics/activity-heatmap';

const agentValues = ['all', ...ALL_AGENTS] as const;

const querySchema = z.object({
  agent: z.enum(agentValues).default('all'),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      agent: searchParams.get('agent') || undefined,
      year: searchParams.get('year') || undefined,
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const createdYear = dbUser.createdAt.getUTCFullYear();

    let period: HeatmapPeriod = { kind: 'rolling', months: 12 };
    if (parsed.year) {
      const yearNum = Number.parseInt(parsed.year, 10);
      if (yearNum < createdYear || yearNum > currentYear) {
        return NextResponse.json(
          { error: 'Year out of allowed range' },
          { status: 400 }
        );
      }
      period = { kind: 'year', year: yearNum };
    }

    const data = await getUserHeatmapData(
      user.id,
      dbUser.createdAt,
      { agent: parsed.agent as AgentFilter, period },
      now
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid filters' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('User activity API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
