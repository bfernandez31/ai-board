import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { Prisma } from '@prisma/client';
import type { AgentOption, HeatmapDayData, HeatmapFilters, HeatmapResponse, NamedAgent } from './types';

function getDateRange(filters: HeatmapFilters): { start: Date; end: Date } {
  const now = new Date();
  if (filters.year === 'rolling') {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const year = filters.year;
  const currentYear = now.getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = year === currentYear
    ? new Date(now)
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      { agent: null, project: { is: { defaultAgent: agent } } },
    ],
  };
}

function buildProjectAccessWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

async function getProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: buildProjectAccessWhere(userId),
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getHeatmapData(
  userId: string,
  filters: HeatmapFilters
): Promise<HeatmapResponse> {
  const projectIds = await getProjectIds(userId);
  const { start, end } = getDateRange(filters);

  if (projectIds.length === 0) {
    return {
      days: [],
      totalJobs: 0,
      totalTicketsShipped: 0,
      availableYears: [],
      availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0 }],
      period: { start: formatDateUTC(start), end: formatDateUTC(end) },
    };
  }

  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const jobTicketFilter: Prisma.TicketWhereInput = {
    projectId: { in: projectIds },
    ...(agentWhere ?? {}),
  };

  // Fetch jobs in the date range
  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: { in: ['COMPLETED', 'FAILED'] },
      completedAt: { gte: start, lte: end },
      ticket: { is: agentWhere ?? {} },
    },
    select: {
      completedAt: true,
      costUsd: true,
    },
  });

  // Fetch shipped tickets in the date range
  const shippedTickets = await prisma.ticket.findMany({
    where: {
      ...jobTicketFilter,
      stage: 'SHIP',
      updatedAt: { gte: start, lte: end },
    },
    select: {
      updatedAt: true,
    },
  });

  // Aggregate jobs by date
  const dayMap = new Map<string, { jobCount: number; costUsd: number | null; ticketsShipped: number }>();

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const dateKey = formatDateUTC(job.completedAt);
    const existing = dayMap.get(dateKey) ?? { jobCount: 0, costUsd: null, ticketsShipped: 0 };
    existing.jobCount += 1;
    if (job.costUsd != null) {
      existing.costUsd = (existing.costUsd ?? 0) + job.costUsd;
    }
    dayMap.set(dateKey, existing);
  }

  // Aggregate shipped tickets by date
  for (const ticket of shippedTickets) {
    const dateKey = formatDateUTC(ticket.updatedAt);
    const existing = dayMap.get(dateKey) ?? { jobCount: 0, costUsd: null, ticketsShipped: 0 };
    existing.ticketsShipped += 1;
    dayMap.set(dateKey, existing);
  }

  const days: HeatmapDayData[] = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      jobCount: data.jobCount,
      costUsd: data.costUsd != null ? Math.round(data.costUsd * 100) / 100 : null,
      ticketsShipped: data.ticketsShipped,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalJobs = days.reduce((sum, d) => sum + d.jobCount, 0);
  const totalTicketsShipped = days.reduce((sum, d) => sum + d.ticketsShipped, 0);

  const [availableYears, availableAgents] = await Promise.all([
    getAvailableYears(userId, projectIds),
    getAvailableAgents(userId, projectIds),
  ]);

  return {
    days,
    totalJobs,
    totalTicketsShipped,
    availableYears,
    availableAgents,
    period: { start: formatDateUTC(start), end: formatDateUTC(end) },
  };
}

async function getAvailableYears(_userId: string, projectIds: number[]): Promise<number[]> {
  if (projectIds.length === 0) return [];

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: { in: ['COMPLETED', 'FAILED'] },
      completedAt: { not: null },
    },
    select: { completedAt: true },
    distinct: ['completedAt'],
  });

  const years = new Set<number>();
  for (const job of jobs) {
    if (job.completedAt) {
      years.add(job.completedAt.getFullYear());
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

async function getAvailableAgents(_userId: string, projectIds: number[]): Promise<AgentOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: { some: { status: { in: ['COMPLETED', 'FAILED'] } } },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: true } },
    },
  });

  const counts = new Map<NamedAgent, number>();
  for (const a of ALL_AGENTS) {
    counts.set(a, 0);
  }

  for (const ticket of tickets) {
    const effectiveAgent = (ticket.agent ?? ticket.project.defaultAgent) as NamedAgent;
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + ticket._count.jobs);
  }

  const options: AgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: Array.from(counts.values()).reduce((sum, c) => sum + c, 0),
    },
  ];

  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({ value: agent, label: getAgentLabel(agent), jobCount });
    }
  }

  return options;
}
