import { JobStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import {
  DAY_MS,
  DEFAULT_HEATMAP_FILTERS,
  buildPeriodOptions,
  fillDateRange,
  getPeriodBounds,
  toISODate,
} from './aggregations';
import type {
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapNamedAgent,
} from './types';

/**
 * Prisma Ticket filter enforcing "effective agent" resolution:
 * a ticket matches when ticket.agent === target OR (ticket.agent IS NULL AND
 * project.defaultAgent === target). Returns undefined for the "all" option.
 */
function buildEffectiveAgentWhere(
  agent: HeatmapFilters['agent']
): Prisma.TicketWhereInput | undefined {
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

function buildUserAccessProjectWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

async function getAvailableAgentsForUser(userId: string): Promise<HeatmapAgentOption[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      project: { is: buildUserAccessProjectWhere(userId) },
      jobs: { some: {} },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
    },
  });

  const present = new Set<HeatmapNamedAgent>();
  for (const ticket of tickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as HeatmapNamedAgent;
    present.add(effective);
  }

  const options: HeatmapAgentOption[] = [{ value: 'all', label: 'All agents' }];
  for (const agent of ALL_AGENTS) {
    if (present.has(agent)) {
      options.push({ value: agent, label: getAgentLabel(agent) });
    }
  }
  return options;
}

function normalizeFilters(
  filters: Partial<HeatmapFilters>,
  agentOptions: HeatmapAgentOption[]
): HeatmapFilters {
  const normalized: HeatmapFilters = {
    period: filters.period ?? DEFAULT_HEATMAP_FILTERS.period,
    agent: filters.agent ?? DEFAULT_HEATMAP_FILTERS.agent,
  };
  if (
    normalized.agent !== 'all' &&
    !agentOptions.some((option) => option.value === normalized.agent)
  ) {
    normalized.agent = 'all';
  }
  return normalized;
}

/**
 * Fetch heatmap data for the authenticated user. Queries jobs (for cell
 * intensity and cost tooltip) and `ship`-command completions (for shipped
 * counter/tooltip) across every project the user owns or is a member of.
 */
export async function getHeatmapData(
  userId: string,
  accountCreatedAt: Date,
  filters: Partial<HeatmapFilters> = DEFAULT_HEATMAP_FILTERS
): Promise<HeatmapData> {
  const now = new Date();
  const agentOptions = await getAvailableAgentsForUser(userId);
  const normalizedFilters = normalizeFilters(filters, agentOptions);
  const { start, end } = getPeriodBounds(normalizedFilters.period, now);

  // End-exclusive upper bound for range comparisons: start of the day after `end`.
  const rangeEndExclusive = new Date(end.getTime() + DAY_MS);

  const ticketAgentWhere = buildEffectiveAgentWhere(normalizedFilters.agent);
  const ticketWhere: Prisma.TicketWhereInput = {
    project: { is: buildUserAccessProjectWhere(userId) },
    ...(ticketAgentWhere ?? {}),
  };

  const [jobs, shipJobs] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticket: { is: ticketWhere },
        completedAt: { gte: start, lt: rangeEndExclusive },
      },
      select: { completedAt: true, costUsd: true },
    }),
    prisma.job.findMany({
      where: {
        command: 'ship',
        status: JobStatus.COMPLETED,
        ticket: { is: ticketWhere },
        completedAt: { gte: start, lt: rangeEndExclusive },
      },
      select: { completedAt: true },
    }),
  ]);

  const dates = fillDateRange(start, end);
  const dayMap = new Map<string, HeatmapDay>();
  for (const date of dates) {
    dayMap.set(date, { date, jobCount: 0, totalCost: null, ticketsShipped: 0 });
  }

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = toISODate(job.completedAt);
    const day = dayMap.get(key);
    if (!day) continue;
    day.jobCount += 1;
    if (job.costUsd != null) {
      day.totalCost = (day.totalCost ?? 0) + job.costUsd;
    }
  }

  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const key = toISODate(job.completedAt);
    const day = dayMap.get(key);
    if (!day) continue;
    day.ticketsShipped += 1;
  }

  const days = Array.from(dayMap.values());
  const totalJobs = days.reduce((sum, day) => sum + day.jobCount, 0);
  const totalShipped = days.reduce((sum, day) => sum + day.ticketsShipped, 0);

  return {
    days,
    periodStart: toISODate(start),
    periodEnd: toISODate(end),
    totalJobs,
    totalShipped,
    filters: normalizedFilters,
    periodOptions: buildPeriodOptions(accountCreatedAt, now),
    agentOptions,
    generatedAt: now.toISOString(),
  };
}
