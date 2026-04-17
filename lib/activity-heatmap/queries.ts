import { JobStatus, type Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, AGENT_LABELS } from '@/app/lib/utils/agent-resolution';
import {
  DEFAULT_HEATMAP_PERIOD,
  formatIsoDate,
  getAvailablePeriods,
  getPeriodBoundaries,
  isValidPeriod,
} from './aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapPeriod,
} from './types';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function normalizeHeatmapFilters(
  input: Partial<HeatmapFilters> | undefined,
  availableAgents: HeatmapAgentOption[],
  availablePeriods: HeatmapPeriod[]
): HeatmapFilters {
  const requestedPeriod = input?.period && isValidPeriod(input.period) ? input.period : null;
  const period: HeatmapPeriod =
    requestedPeriod && availablePeriods.includes(requestedPeriod)
      ? requestedPeriod
      : DEFAULT_HEATMAP_PERIOD;

  const agentValues = new Set(availableAgents.map((option) => option.value));
  const requestedAgent = input?.agent;
  const agent: HeatmapAgentFilter =
    requestedAgent && agentValues.has(requestedAgent) ? requestedAgent : 'all';

  return { period, agent };
}

async function getUserProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function getAvailableHeatmapAgents(projectIds: number[]): Promise<HeatmapAgentOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

  const grouped = await prisma.job.groupBy({
    by: ['ticketId'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });

  if (grouped.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

  const ticketIds = grouped.map((g) => g.ticketId);
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    select: {
      id: true,
      agent: true,
      project: { select: { defaultAgent: true } },
    },
  });

  const ticketAgentMap = new Map<number, Agent>();
  for (const ticket of tickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as Agent;
    ticketAgentMap.set(ticket.id, effective);
  }

  const counts = new Map<Agent, number>();
  for (const row of grouped) {
    const agent = ticketAgentMap.get(row.ticketId);
    if (!agent) continue;
    counts.set(agent, (counts.get(agent) ?? 0) + row._count._all);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs },
  ];

  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({ value: agent, label: AGENT_LABELS[agent], jobCount });
    }
  }

  return options;
}

function buildAgentTicketFilter(agent: HeatmapAgentFilter) {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as Agent },
      {
        agent: null,
        project: { is: { defaultAgent: agent as Agent } },
      },
    ],
  };
}

export async function getHeatmapData(
  userId: string,
  userCreatedAt: Date,
  rawFilters: Partial<HeatmapFilters> | undefined,
  now: Date = new Date()
): Promise<HeatmapData> {
  const projectIds = await getUserProjectIds(userId);
  const availableAgents = await getAvailableHeatmapAgents(projectIds);
  const availablePeriods = getAvailablePeriods(userCreatedAt, now);

  const filters = normalizeHeatmapFilters(rawFilters, availableAgents, availablePeriods);
  const { startDate, endDate } = getPeriodBoundaries(filters.period, now);
  const endExclusive = addDays(endDate, 1);

  if (projectIds.length === 0) {
    return {
      days: [],
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(endDate),
      totalJobs: 0,
      totalShipped: 0,
      availableAgents,
      availablePeriods,
      filters,
      generatedAt: now.toISOString(),
    };
  }

  const agentTicketWhere = buildAgentTicketFilter(filters.agent);

  const jobWhere = {
    projectId: { in: projectIds },
    startedAt: {
      gte: startDate,
      lt: endExclusive,
    },
    ...(agentTicketWhere
      ? { ticket: { is: agentTicketWhere } }
      : {}),
  };

  const shipJobWhere = {
    projectId: { in: projectIds },
    command: 'ship',
    status: JobStatus.COMPLETED,
    completedAt: {
      gte: startDate,
      lt: endExclusive,
    },
    ...(agentTicketWhere
      ? { ticket: { is: agentTicketWhere } }
      : {}),
  };

  const [jobs, shipJobs] = await Promise.all([
    prisma.job.findMany({
      where: jobWhere,
      select: {
        startedAt: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: shipJobWhere,
      select: {
        completedAt: true,
        ticketId: true,
      },
    }),
  ]);

  const dayMap = new Map<string, HeatmapDay>();

  const ensureDay = (dateStr: string): HeatmapDay => {
    let day = dayMap.get(dateStr);
    if (!day) {
      day = {
        date: dateStr,
        jobCount: 0,
        totalCost: 0,
        hasCost: false,
        ticketsShipped: 0,
      };
      dayMap.set(dateStr, day);
    }
    return day;
  };

  for (const job of jobs) {
    const dateStr = formatIsoDate(startOfUtcDay(job.startedAt));
    const day = ensureDay(dateStr);
    day.jobCount += 1;
    if (job.costUsd != null) {
      day.totalCost += job.costUsd;
      day.hasCost = true;
    }
  }

  // Dedupe shipped by (ticketId, date) so a ticket counts once per day.
  const shippedSeen = new Set<string>();
  let totalShipped = 0;
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const dateStr = formatIsoDate(startOfUtcDay(job.completedAt));
    const key = `${job.ticketId}:${dateStr}`;
    if (shippedSeen.has(key)) continue;
    shippedSeen.add(key);
    const day = ensureDay(dateStr);
    day.ticketsShipped += 1;
    totalShipped += 1;
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
    totalJobs: jobs.length,
    totalShipped,
    availableAgents,
    availablePeriods,
    filters,
    generatedAt: now.toISOString(),
  };
}
