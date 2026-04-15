import { JobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import { getAgentLabel } from '@/lib/analytics/aggregations';
import type { AgentOption, AgentFilter, NamedAgent } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapDay, HeatmapFilters } from './types';

function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') {
    return undefined;
  }

  return {
    OR: [
      { agent },
      {
        agent: null,
        project: {
          is: {
            defaultAgent: agent,
          },
        },
      },
    ],
  };
}

function getDateRange(year: string, now: Date): { start: Date; end: Date } {
  if (year === 'last-12-months') {
    // Today - 364 days, Sunday-aligned
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    // Advance end to Saturday of current week
    const endDay = end.getDay();
    if (endDay !== 6) {
      end.setDate(end.getDate() + (6 - endDay));
    }

    const start = new Date(end);
    start.setDate(start.getDate() - 364);
    // Align to Sunday (should already be Sunday since we set end to Saturday and went back 364 days = 52 weeks)
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  const yearNum = parseInt(year, 10);
  return {
    start: new Date(yearNum, 0, 1, 0, 0, 0, 0),
    end: new Date(yearNum, 11, 31, 23, 59, 59, 999),
  };
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapData> {
  const now = new Date();
  const { start, end } = getDateRange(filters.year, now);

  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const ticketWhere: Prisma.TicketWhereInput = {
    project: { userId },
    ...(agentWhere ?? {}),
  };

  // Fetch all COMPLETED jobs in the date range across user's projects
  const jobs = await prisma.job.findMany({
    where: {
      status: JobStatus.COMPLETED,
      completedAt: { gte: start, lte: end },
      ticket: { is: ticketWhere },
    },
    select: {
      completedAt: true,
      costUsd: true,
      command: true,
      ticket: {
        select: {
          ticketKey: true,
        },
      },
    },
  });

  // Group by date
  const dayMap = new Map<string, { jobCount: number; costSum: number | null; shippedSet: Set<string> }>();

  for (const job of jobs) {
    if (!job.completedAt) continue;

    const dateKey = formatDateKey(job.completedAt);
    let entry = dayMap.get(dateKey);
    if (!entry) {
      entry = { jobCount: 0, costSum: null, shippedSet: new Set() };
      dayMap.set(dateKey, entry);
    }

    entry.jobCount += 1;

    if (job.costUsd !== null) {
      entry.costSum = (entry.costSum ?? 0) + job.costUsd;
    }

    if (job.command === 'ship' && job.ticket?.ticketKey) {
      entry.shippedSet.add(job.ticket.ticketKey);
    }
  }

  const days: HeatmapDay[] = Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    jobCount: data.jobCount,
    costUsd: data.costSum !== null ? Math.round(data.costSum * 100) / 100 : null,
    shippedTickets: Array.from(data.shippedSet),
  }));

  const totalJobs = jobs.length;
  const totalShippedSet = new Set<string>();
  for (const day of days) {
    for (const key of day.shippedTickets) {
      totalShippedSet.add(key);
    }
  }

  // Available agents: query across all user projects (unfiltered by date/agent)
  const agentTickets = await prisma.ticket.findMany({
    where: {
      project: { userId },
      jobs: { some: { status: JobStatus.COMPLETED } },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: { where: { status: JobStatus.COMPLETED } } } },
    },
  });

  const agentCounts = new Map<string, number>([
    ...ALL_AGENTS.map((a) => [a, 0] as const),
  ]);

  for (const ticket of agentTickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as NamedAgent;
    agentCounts.set(effective, (agentCounts.get(effective) ?? 0) + ticket._count.jobs);
  }

  const availableAgents: AgentOption[] = [
    {
      value: 'all' as AgentFilter,
      label: 'All agents',
      jobCount: Array.from(agentCounts.values()).reduce((sum, c) => sum + c, 0),
      isDefault: true,
    },
  ];

  for (const agent of ALL_AGENTS) {
    const jobCount = agentCounts.get(agent) ?? 0;
    if (jobCount > 0) {
      availableAgents.push({
        value: agent as AgentFilter,
        label: getAgentLabel(agent),
        jobCount,
        isDefault: false,
      });
    }
  }

  // Available years
  const yearJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.COMPLETED,
      ticket: { is: { project: { userId } } },
      completedAt: { not: null },
    },
    select: { completedAt: true },
    distinct: ['completedAt'],
  });

  const yearSet = new Set<number>();
  for (const j of yearJobs) {
    if (j.completedAt) {
      yearSet.add(j.completedAt.getFullYear());
    }
  }
  const availableYears = Array.from(yearSet).sort((a, b) => a - b);

  // User createdAt
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  return {
    days,
    totalJobs,
    totalShipped: totalShippedSet.size,
    availableAgents,
    availableYears,
    userCreatedAt: user?.createdAt?.toISOString() ?? now.toISOString(),
    generatedAt: now.toISOString(),
  };
}
