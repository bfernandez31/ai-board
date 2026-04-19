import { JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import {
  buildAvailableYears,
  DEFAULT_HEATMAP_FILTERS,
  formatUtcDate,
  getPeriodBounds,
} from './aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapPeriod,
} from './types';

interface DayAccumulator {
  jobCount: number;
  totalCost: number;
  costRecorded: boolean;
  shipped: number;
}

function buildAgentTicketWhere(agent: HeatmapAgentFilter): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      {
        agent: null,
        project: { is: { defaultAgent: agent } },
      },
    ],
  };
}

function buildProjectMembershipWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

async function fetchUserCreatedAt(userId: string): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  return user?.createdAt ?? new Date();
}

async function fetchUserProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: buildProjectMembershipWhere(userId),
    select: { id: true },
  });
  return projects.map((project) => project.id);
}

async function fetchAvailableAgents(projectIds: number[]): Promise<HeatmapAgentOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: { some: {} },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: true } },
    },
  });

  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as string;
    counts.set(effective, (counts.get(effective) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs },
  ];
  for (const agent of ALL_AGENTS) {
    const count = counts.get(agent) ?? 0;
    if (count > 0) {
      options.push({ value: agent, label: getAgentLabel(agent), jobCount: count });
    }
  }
  return options;
}

export function normalizeHeatmapFilters(
  raw: Partial<HeatmapFilters>,
  availableAgents: HeatmapAgentOption[],
  availableYears: number[]
): HeatmapFilters {
  let period: HeatmapPeriod = raw.period ?? DEFAULT_HEATMAP_FILTERS.period;
  if (typeof period === 'number' && !availableYears.includes(period)) {
    period = DEFAULT_HEATMAP_FILTERS.period;
  }

  let agent: HeatmapAgentFilter = raw.agent ?? DEFAULT_HEATMAP_FILTERS.agent;
  if (agent !== 'all' && !availableAgents.some((option) => option.value === agent)) {
    agent = 'all';
  }

  return { period, agent };
}

export async function getHeatmapData(
  userId: string,
  rawFilters: Partial<HeatmapFilters> = DEFAULT_HEATMAP_FILTERS,
  now: Date = new Date()
): Promise<HeatmapData> {
  const [createdAt, projectIds] = await Promise.all([
    fetchUserCreatedAt(userId),
    fetchUserProjectIds(userId),
  ]);
  const availableAgents = await fetchAvailableAgents(projectIds);

  const availableYears = buildAvailableYears(createdAt, now);
  const filters = normalizeHeatmapFilters(rawFilters, availableAgents, availableYears);
  const bounds = getPeriodBounds(filters.period, now);
  // End of day exclusive bound for DB queries.
  const endExclusive = new Date(bounds.end.getTime() + 86_400_000);

  if (projectIds.length === 0) {
    return {
      startDate: formatUtcDate(bounds.start),
      endDate: formatUtcDate(bounds.end),
      days: [],
      totals: { jobCount: 0, ticketsShipped: 0 },
      availableAgents,
      availableYears,
      filters,
      generatedAt: now.toISOString(),
    };
  }

  const agentTicketWhere = buildAgentTicketWhere(filters.agent);

  const jobWhere: Prisma.JobWhereInput = {
    projectId: { in: projectIds },
    completedAt: { gte: bounds.start, lt: endExclusive },
    ...(agentTicketWhere ? { ticket: { is: agentTicketWhere } } : {}),
  };

  const [jobs, shipJobs] = await Promise.all([
    prisma.job.findMany({
      where: jobWhere,
      select: { completedAt: true, costUsd: true },
    }),
    prisma.job.findMany({
      where: {
        ...jobWhere,
        command: 'ship',
        status: JobStatus.COMPLETED,
      },
      select: { completedAt: true },
    }),
  ]);

  const accumulator = new Map<string, DayAccumulator>();
  const emptyDay = (): DayAccumulator => ({
    jobCount: 0,
    totalCost: 0,
    costRecorded: false,
    shipped: 0,
  });

  let totalJobCount = 0;
  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = formatUtcDate(job.completedAt);
    const entry = accumulator.get(key) ?? emptyDay();
    entry.jobCount += 1;
    if (job.costUsd != null) {
      entry.totalCost += job.costUsd;
      entry.costRecorded = true;
    }
    accumulator.set(key, entry);
    totalJobCount += 1;
  }

  let ticketsShipped = 0;
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const key = formatUtcDate(job.completedAt);
    const entry = accumulator.get(key) ?? emptyDay();
    entry.shipped += 1;
    accumulator.set(key, entry);
    ticketsShipped += 1;
  }

  const days: HeatmapDay[] = Array.from(accumulator.entries())
    .map(([date, entry]) => ({
      date,
      jobCount: entry.jobCount,
      totalCost: entry.costRecorded ? Math.round(entry.totalCost * 100) / 100 : null,
      shipped: entry.shipped,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    startDate: formatUtcDate(bounds.start),
    endDate: formatUtcDate(bounds.end),
    days,
    totals: { jobCount: totalJobCount, ticketsShipped },
    availableAgents,
    availableYears,
    filters,
    generatedAt: now.toISOString(),
  };
}
