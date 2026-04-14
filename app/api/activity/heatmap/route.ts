import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  agent: z.enum(['all', ...ALL_AGENTS] as [string, ...string[]]).default('all'),
});

export interface HeatmapDayData {
  date: string; // YYYY-MM-DD
  jobCount: number;
  shippedCount: number;
  totalCost: number;
}

export interface HeatmapResponse {
  days: HeatmapDayData[];
  totalJobs: number;
  totalShipped: number;
  yearStart: string;
  yearEnd: string;
  availableYears: number[];
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<HeatmapResponse | { error: string }>> {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      year: searchParams.get('year') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { year, agent } = queryResult.data;

    // Calculate date range
    let yearStart: Date;
    let yearEnd: Date;

    if (year) {
      // Calendar year view
      yearStart = new Date(Date.UTC(year, 0, 1));
      yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    } else {
      // Rolling 12 months (default)
      yearEnd = new Date();
      yearStart = new Date(yearEnd);
      yearStart.setFullYear(yearStart.getFullYear() - 1);
      yearStart.setDate(yearStart.getDate() + 1);
    }

    // Get all project IDs the user has access to
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });

    const projectIds = userProjects.map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({
        days: [],
        totalJobs: 0,
        totalShipped: 0,
        yearStart: yearStart.toISOString(),
        yearEnd: yearEnd.toISOString(),
        availableYears: [],
      });
    }

    // Build agent filter for jobs (via ticket agent)
    const agentFilter: { ticket?: { agent?: Agent } } =
      agent !== 'all' ? { ticket: { agent: agent as Agent } } : {};

    // Fetch jobs and shipped tickets in parallel
    const [jobs, shippedTickets, oldestJob] = await Promise.all([
      prisma.job.findMany({
        where: {
          projectId: { in: projectIds },
          startedAt: { gte: yearStart, lte: yearEnd },
          ...agentFilter,
        },
        select: {
          startedAt: true,
          costUsd: true,
        },
      }),

      prisma.ticket.findMany({
        where: {
          projectId: { in: projectIds },
          stage: { in: ['SHIP', 'CLOSED'] },
          closedAt: { gte: yearStart, lte: yearEnd },
          ...(agent !== 'all' ? { agent: agent as Agent } : {}),
        },
        select: {
          closedAt: true,
          updatedAt: true,
        },
      }),

      // Get the oldest job to determine available years
      prisma.job.findFirst({
        where: { projectId: { in: projectIds } },
        orderBy: { startedAt: 'asc' },
        select: { startedAt: true },
      }),
    ]);

    // Aggregate jobs by date
    const dayMap = new Map<string, HeatmapDayData>();

    for (const job of jobs) {
      const dateKey = job.startedAt.toISOString().slice(0, 10);
      const existing = dayMap.get(dateKey);
      if (existing) {
        existing.jobCount += 1;
        existing.totalCost += job.costUsd ?? 0;
      } else {
        dayMap.set(dateKey, {
          date: dateKey,
          jobCount: 1,
          shippedCount: 0,
          totalCost: job.costUsd ?? 0,
        });
      }
    }

    // Aggregate shipped tickets by date (use closedAt if available, else updatedAt)
    for (const ticket of shippedTickets) {
      const shippedDate = ticket.closedAt ?? ticket.updatedAt;
      const dateKey = shippedDate.toISOString().slice(0, 10);
      const existing = dayMap.get(dateKey);
      if (existing) {
        existing.shippedCount += 1;
      } else {
        dayMap.set(dateKey, {
          date: dateKey,
          jobCount: 0,
          shippedCount: 1,
          totalCost: 0,
        });
      }
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const currentYear = new Date().getFullYear();
    const oldestYear = oldestJob
      ? oldestJob.startedAt.getFullYear()
      : currentYear;
    const availableYears = Array.from(
      { length: currentYear - oldestYear + 1 },
      (_, i) => currentYear - i
    );

    const totalJobs = jobs.length;
    const totalShipped = shippedTickets.length;

    return NextResponse.json({
      days,
      totalJobs,
      totalShipped,
      yearStart: yearStart.toISOString(),
      yearEnd: yearEnd.toISOString(),
      availableYears,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in' },
        { status: 401 }
      );
    }

    console.error('[Heatmap API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
