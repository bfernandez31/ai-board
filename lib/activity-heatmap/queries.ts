import { JobStatus } from '@prisma/client';
import type { Agent, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import {
  buildPeriodOptions,
  enumerateDays,
  parseIsoDate,
  resolvePeriodRange,
  toIsoDate,
} from './period';
import {
  DEFAULT_HEATMAP_FILTERS,
  type ActivityHeatmapData,
  type HeatmapAgentFilter,
  type HeatmapAgentOption,
  type HeatmapDay,
  type HeatmapFilters,
  type HeatmapShippedTicket,
} from './types';

/**
 * Status filter for heatmap job counting.
 * We count completed + failed jobs: both represent actual AI activity that
 * consumed resources and left a record. Pending/running jobs are excluded
 * because they may later be cancelled or retried.
 */
const ACTIVITY_JOB_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

function buildAgentTicketWhere(
  agent: HeatmapAgentFilter
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent: agent as Agent },
      {
        agent: null,
        project: {
          is: {
            defaultAgent: agent as Agent,
          },
        },
      },
    ],
  };
}

function buildProjectAccessWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

/**
 * Count jobs-per-effective-agent across the user's accessible projects to
 * build the dropdown dynamically. We combine explicit ticket.agent values
 * with the project.defaultAgent fallback (see effective agent resolution).
 */
async function getAvailableAgentsForUser(userId: string): Promise<HeatmapAgentOption[]> {
  const rows = await prisma.ticket.findMany({
    where: {
      project: buildProjectAccessWhere(userId),
      jobs: {
        some: {
          status: { in: ACTIVITY_JOB_STATUSES },
        },
      },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: {
        select: {
          jobs: {
            where: {
              status: { in: ACTIVITY_JOB_STATUSES },
            },
          },
        },
      },
    },
  });

  const counts = new Map<Agent, number>(ALL_AGENTS.map((agent) => [agent, 0]));
  for (const ticket of rows) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as Agent;
    counts.set(effective, (counts.get(effective) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: totalJobs },
  ];
  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({ value: agent, label: getAgentLabel(agent), jobCount });
    }
  }
  return options;
}

/**
 * Return the inclusive [start, end) range spanning the end of `endIso` day.
 * End is exclusive so we can compare with `completedAt` / `startedAt` cleanly.
 */
function dateRangeBounds(startIso: string, endIso: string): { gte: Date; lt: Date } {
  const start = parseIsoDate(startIso);
  const endExclusive = parseIsoDate(endIso);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { gte: start, lt: endExclusive };
}

export interface HeatmapQueryInput {
  userId: string;
  userCreatedAt: Date;
  filters?: Partial<HeatmapFilters>;
  now?: Date;
}

/**
 * Fetch the heatmap data for a user.
 *
 * Shipped tickets are derived from `ship` command jobs with status COMPLETED —
 * NOT from Stage=SHIP. A ticket counts as shipped on the UTC day its ship job
 * completed successfully.
 */
export async function getActivityHeatmapData({
  userId,
  userCreatedAt,
  filters,
  now = new Date(),
}: HeatmapQueryInput): Promise<ActivityHeatmapData> {
  // Resolve available agents first so we can reset unknown agent filters to
  // 'all' — otherwise e.g. a shared URL with agent=GEMINI would return an
  // empty dataset when the user only has CLAUDE activity.
  const availableAgents = await getAvailableAgentsForUser(userId);
  const availableAgentValues = new Set(availableAgents.map((a) => a.value));

  const requestedAgent = filters?.agent ?? DEFAULT_HEATMAP_FILTERS.agent;
  const normalized: HeatmapFilters = {
    period: filters?.period ?? DEFAULT_HEATMAP_FILTERS.period,
    agent: availableAgentValues.has(requestedAgent)
      ? requestedAgent
      : DEFAULT_HEATMAP_FILTERS.agent,
  };

  const period = resolvePeriodRange(normalized.period, now);
  const { gte, lt } = dateRangeBounds(period.startDate, period.endDate);
  const agentWhere = buildAgentTicketWhere(normalized.agent);
  const projectAccessWhere = buildProjectAccessWhere(userId);

  const ticketWhere: Prisma.TicketWhereInput = {
    project: projectAccessWhere,
    ...(agentWhere ?? {}),
  };

  // --- 1) All activity jobs (COMPLETED + FAILED) in the period
  const activityJobs = await prisma.job.findMany({
    where: {
      status: { in: ACTIVITY_JOB_STATUSES },
      startedAt: { gte, lt },
      ticket: { is: ticketWhere },
    },
    select: {
      startedAt: true,
      costUsd: true,
    },
  });

  // --- 2) Shipped tickets: ship-command jobs that completed successfully
  const shipJobs = await prisma.job.findMany({
    where: {
      status: JobStatus.COMPLETED,
      command: 'ship',
      completedAt: { gte, lt },
      ticket: { is: ticketWhere },
    },
    select: {
      completedAt: true,
      ticket: {
        select: {
          ticketKey: true,
          title: true,
          project: { select: { key: true } },
        },
      },
    },
    orderBy: { completedAt: 'asc' },
  });

  // --- 3) Available agent options already resolved above (used to normalize
  //       unknown agent filters before querying).

  // Initialize days array with zeros for every day in the range
  const dayMap = new Map<string, HeatmapDay>();
  for (const isoDate of enumerateDays(period.startDate, period.endDate)) {
    dayMap.set(isoDate, {
      date: isoDate,
      jobCount: 0,
      totalCost: 0,
      costIncomplete: false,
      shippedTickets: [],
    });
  }

  for (const job of activityJobs) {
    if (!job.startedAt) continue;
    const key = toIsoDate(job.startedAt);
    const entry = dayMap.get(key);
    if (!entry) continue;
    entry.jobCount += 1;
    if (job.costUsd == null) {
      entry.costIncomplete = true;
    } else {
      entry.totalCost += job.costUsd;
    }
  }

  let shippedCount = 0;
  for (const job of shipJobs) {
    if (!job.completedAt) continue;
    const key = toIsoDate(job.completedAt);
    const entry = dayMap.get(key);
    if (!entry) continue;
    const ticket: HeatmapShippedTicket = {
      ticketKey: job.ticket.ticketKey,
      title: job.ticket.title,
      projectKey: job.ticket.project.key,
    };
    if (!entry.shippedTickets.some((t) => t.ticketKey === ticket.ticketKey)) {
      entry.shippedTickets.push(ticket);
      shippedCount += 1;
    }
  }

  // Round totals once (avoid floating drift in the tooltip)
  const days: HeatmapDay[] = Array.from(dayMap.values()).map((day) => ({
    ...day,
    totalCost: Math.round(day.totalCost * 100) / 100,
  }));

  const periodOptions = buildPeriodOptions(userCreatedAt, now);

  return {
    period,
    periodOptions,
    availableAgents,
    days,
    totals: {
      jobCount: activityJobs.length,
      ticketsShipped: shippedCount,
    },
    filters: normalized,
    generatedAt: now.toISOString(),
  };
}
