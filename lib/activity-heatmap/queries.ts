import type { Agent, Prisma } from '@prisma/client';
import { JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import {
  buildAvailablePeriods,
  formatISODate,
  resolvePeriod,
} from './aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapPeriodOption,
} from './types';

function buildEffectiveAgentTicketWhere(
  agent: HeatmapAgentFilter
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  const named = agent as Agent;
  return {
    OR: [
      { agent: named },
      {
        agent: null,
        project: { is: { defaultAgent: named } },
      },
    ],
  };
}

async function getUserProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function getUserCreatedAt(userId: string): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  return user?.createdAt ?? new Date();
}

async function getAvailableAgents(projectIds: number[]): Promise<HeatmapAgentOption[]> {
  if (projectIds.length === 0) {
    return [{ value: 'all', label: 'All agents', jobCount: 0 }];
  }

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: JobStatus.COMPLETED,
    },
    select: {
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });

  const counts = new Map<Agent, number>();
  for (const job of jobs) {
    const effective = (job.ticket.agent ?? job.ticket.project.defaultAgent) as Agent;
    counts.set(effective, (counts.get(effective) ?? 0) + 1);
  }

  const options: HeatmapAgentOption[] = [
    { value: 'all', label: 'All agents', jobCount: jobs.length },
  ];

  for (const agent of ALL_AGENTS) {
    const count = counts.get(agent) ?? 0;
    if (count > 0) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        jobCount: count,
      });
    }
  }

  return options;
}

async function getHeatmapDays(
  projectIds: number[],
  filters: HeatmapFilters,
  periodStart: Date,
  periodEnd: Date
): Promise<HeatmapDay[]> {
  if (projectIds.length === 0) return [];

  const agentWhere = buildEffectiveAgentTicketWhere(filters.agent);

  const jobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: JobStatus.COMPLETED,
      completedAt: { gte: periodStart, lte: periodEnd },
      ...(agentWhere ? { ticket: { is: agentWhere } } : {}),
    },
    select: {
      completedAt: true,
      costUsd: true,
      command: true,
      ticketId: true,
    },
  });

  interface DayBucket {
    jobCount: number;
    costSum: number;
    costSamples: number;
    shippedTickets: Set<number>;
  }
  const buckets = new Map<string, DayBucket>();

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = formatISODate(job.completedAt);
    const bucket = buckets.get(key) ?? {
      jobCount: 0,
      costSum: 0,
      costSamples: 0,
      shippedTickets: new Set<number>(),
    };
    bucket.jobCount += 1;
    if (job.costUsd != null) {
      bucket.costSum += job.costUsd;
      bucket.costSamples += 1;
    }
    if (job.command === 'ship') {
      bucket.shippedTickets.add(job.ticketId);
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([date, bucket]) => ({
      date,
      jobCount: bucket.jobCount,
      totalCost:
        bucket.costSamples > 0 ? Math.round(bucket.costSum * 100) / 100 : null,
      ticketsShipped: bucket.shippedTickets.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeFilters(
  filters: Partial<HeatmapFilters>,
  availableAgents: HeatmapAgentOption[],
  availablePeriods: HeatmapPeriodOption[]
): HeatmapFilters {
  const period =
    filters.period && availablePeriods.some((p) => p.value === filters.period)
      ? filters.period
      : 'last-12-months';

  const agent =
    filters.agent && availableAgents.some((a) => a.value === filters.agent)
      ? filters.agent
      : 'all';

  return { period, agent };
}

export async function getActivityHeatmapData(
  userId: string,
  filters: Partial<HeatmapFilters> = {},
  now: Date = new Date()
): Promise<HeatmapData> {
  const [projectIds, userCreatedAt] = await Promise.all([
    getUserProjectIds(userId),
    getUserCreatedAt(userId),
  ]);

  const availablePeriods = buildAvailablePeriods(userCreatedAt, now);
  const availableAgents = await getAvailableAgents(projectIds);
  const normalizedFilters = normalizeFilters(filters, availableAgents, availablePeriods);

  const period = resolvePeriod(normalizedFilters.period, now);
  const days = await getHeatmapDays(
    projectIds,
    normalizedFilters,
    period.start,
    period.end
  );

  const totalJobs = days.reduce((sum, day) => sum + day.jobCount, 0);
  const totalTicketsShipped = days.reduce((sum, day) => sum + day.ticketsShipped, 0);

  return {
    filters: normalizedFilters,
    periodStart: formatISODate(period.start),
    periodEnd: formatISODate(period.end),
    days,
    totalJobs,
    totalTicketsShipped,
    availableAgents,
    availablePeriods,
    generatedAt: now.toISOString(),
  };
}
