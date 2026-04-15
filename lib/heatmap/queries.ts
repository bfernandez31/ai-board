import { JobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { NamedAgent } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapDayData, HeatmapFilters } from './types';

function getDateRange(year: string, now: Date): { start: Date; end: Date } {
  if (year === 'rolling') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const yearNum = parseInt(year, 10);
  return {
    start: new Date(yearNum, 0, 1, 0, 0, 0, 0),
    end: new Date(yearNum, 11, 31, 23, 59, 59, 999),
  };
}

function buildAgentWhere(agent: string): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as NamedAgent },
      {
        agent: null,
        project: { is: { defaultAgent: agent as NamedAgent } },
      },
    ],
  };
}

function toDateKey(date: Date): string {
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
  const agentWhere = buildAgentWhere(filters.agent);

  // First get all project IDs the user has access to
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });
  const projectIds = userProjects.map((p) => p.id);

  if (projectIds.length === 0) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { createdAt: true },
    });
    return emptyHeatmapData(user.createdAt, now, filters);
  }

  // Fetch jobs and ship jobs in parallel
  const [jobs, shipJobs, user] = await Promise.all([
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        status: JobStatus.COMPLETED,
        completedAt: { gte: start, lte: end },
        ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
      },
      select: {
        completedAt: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        command: 'ship',
        status: JobStatus.COMPLETED,
        completedAt: { gte: start, lte: end },
        ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
      },
      select: {
        completedAt: true,
        ticket: {
          select: { ticketKey: true },
        },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { createdAt: true },
    }),
  ]);

  // Aggregate by day
  const days: Record<string, HeatmapDayData> = {};

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = toDateKey(job.completedAt);
    const day = days[key] ?? { jobCount: 0, costUsd: null, ticketsShipped: [] };
    day.jobCount += 1;
    if (job.costUsd != null) {
      day.costUsd = Math.round(((day.costUsd ?? 0) + job.costUsd) * 100) / 100;
    }
    days[key] = day;
  }

  // Track shipped tickets per day (deduplicate by ticketKey per day)
  const shippedPerDay = new Map<string, Set<string>>();
  for (const shipJob of shipJobs) {
    if (!shipJob.completedAt) continue;
    const key = toDateKey(shipJob.completedAt);
    const set = shippedPerDay.get(key) ?? new Set();
    set.add(shipJob.ticket.ticketKey);
    shippedPerDay.set(key, set);
  }

  for (const [key, ticketKeys] of shippedPerDay) {
    const day = days[key] ?? { jobCount: 0, costUsd: null, ticketsShipped: [] };
    day.ticketsShipped = Array.from(ticketKeys);
    days[key] = day;
  }

  // Summary
  const totalJobs = jobs.length;
  const allShippedKeys = new Set<string>();
  for (const shipJob of shipJobs) {
    allShippedKeys.add(shipJob.ticket.ticketKey);
  }

  // Available agents across all user's projects (unfiltered by agent)
  const agentTickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: { some: { status: JobStatus.COMPLETED } },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
    },
  });

  const agentSet = new Set<string>();
  for (const ticket of agentTickets) {
    const effective = ticket.agent ?? ticket.project.defaultAgent;
    agentSet.add(effective);
  }

  const availableAgents = [
    { value: 'all' as const, label: 'All' },
    ...ALL_AGENTS
      .filter((a) => agentSet.has(a))
      .map((a) => ({ value: a as typeof a, label: getAgentLabel(a) })),
  ];

  // Available years
  const createdYear = user.createdAt.getFullYear();
  const currentYear = now.getFullYear();
  const availableYears: number[] = [];
  for (let y = createdYear; y <= currentYear; y++) {
    availableYears.push(y);
  }

  return {
    days,
    summary: {
      totalJobs,
      ticketsShipped: allShippedKeys.size,
    },
    availableAgents,
    availableYears,
    userCreatedAt: user.createdAt.toISOString(),
    filters,
  };
}

function emptyHeatmapData(userCreatedAt: Date, now: Date, filters: HeatmapFilters): HeatmapData {
  const createdYear = userCreatedAt.getFullYear();
  const currentYear = now.getFullYear();
  const availableYears: number[] = [];
  for (let y = createdYear; y <= currentYear; y++) {
    availableYears.push(y);
  }

  return {
    days: {},
    summary: { totalJobs: 0, ticketsShipped: 0 },
    availableAgents: [{ value: 'all', label: 'All' }],
    availableYears,
    userCreatedAt: userCreatedAt.toISOString(),
    filters,
  };
}
