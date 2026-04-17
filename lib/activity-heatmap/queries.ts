/**
 * Activity Heatmap Queries
 *
 * Aggregates `Job` and shipped-ticket data across all of a user's
 * projects (owner OR member) into per-day buckets for the heatmap.
 * Honors effective-agent resolution: a ticket without an explicit agent
 * inherits its project's `defaultAgent`.
 */

import { JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ALL_AGENTS, getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { AgentFilter, AgentOption, NamedAgent } from '@/lib/analytics/types';
import {
  getAvailableYears,
  parseIsoDate,
  resolvePeriod,
  toIsoDate,
  utcDate,
} from './period';
import type {
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapPeriodInfo,
} from './types';

function buildAccessibleProjectsWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

function buildEffectiveAgentJobWhere(
  agent: AgentFilter
): Prisma.JobWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    ticket: {
      is: {
        OR: [
          { agent },
          {
            agent: null,
            project: { is: { defaultAgent: agent } },
          },
        ],
      },
    },
  };
}

interface DayBucket {
  jobCount: number;
  costSum: number;
  costSeen: boolean;
  shippedTicketIds: Set<number>;
}

function emptyBuckets(start: Date, end: Date): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();
  for (
    let cursor = start.getTime();
    cursor <= end.getTime();
    cursor += 24 * 60 * 60 * 1000
  ) {
    const date = new Date(cursor);
    buckets.set(toIsoDate(date), {
      jobCount: 0,
      costSum: 0,
      costSeen: false,
      shippedTicketIds: new Set<number>(),
    });
  }
  return buckets;
}

function periodBoundsToDates(period: HeatmapPeriodInfo): { start: Date; end: Date } {
  return { start: parseIsoDate(period.start), end: parseIsoDate(period.end) };
}

/** End of day in UTC for the given midnight-aligned date. */
function endOfUtcDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Map a Date to a YYYY-MM-DD bucket key in UTC.
 * Jobs that completed on day X (in UTC) belong to bucket X.
 */
function bucketKeyForUtcDate(date: Date): string {
  return toIsoDate(
    utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

async function getAccessibleProjectIds(userId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: buildAccessibleProjectsWhere(userId),
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function getAvailableAgentsForUser(userId: string): Promise<AgentOption[]> {
  // Distinct effective agents across all jobs the user has, weighted by
  // job count for the badge.
  const tickets = await prisma.ticket.findMany({
    where: {
      project: buildAccessibleProjectsWhere(userId),
      jobs: { some: {} },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: true } },
    },
  });

  const counts = new Map<NamedAgent, number>(
    ALL_AGENTS.map((agent) => [agent, 0] as const)
  );

  for (const ticket of tickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as NamedAgent;
    counts.set(effective, (counts.get(effective) ?? 0) + ticket._count.jobs);
  }

  const totalJobs = Array.from(counts.values()).reduce((sum, n) => sum + n, 0);
  const options: AgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: totalJobs,
      isDefault: true,
    },
  ];
  for (const agent of ALL_AGENTS) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({
        value: agent,
        label: getAgentLabel(agent),
        jobCount,
        isDefault: false,
      });
    }
  }
  return options;
}

/**
 * Normalize the requested filter against the data the user actually
 * has — falling back to 'all' when the requested agent has no jobs
 * (mirrors the analytics API behavior).
 */
function normalizeAgent(
  requested: AgentFilter,
  available: AgentOption[]
): AgentFilter {
  if (requested === 'all') return 'all';
  return available.some((option) => option.value === requested) ? requested : 'all';
}

export async function getHeatmapData(
  userId: string,
  userCreatedAt: Date,
  filters: HeatmapFilters,
  now: Date = new Date()
): Promise<HeatmapData> {
  const period = resolvePeriod(filters.period, now);
  const { start, end } = periodBoundsToDates(period);
  const endInclusive = endOfUtcDay(end);

  const availableAgents = await getAvailableAgentsForUser(userId);
  const normalizedAgent = normalizeAgent(filters.agent, availableAgents);
  const agentWhere = buildEffectiveAgentJobWhere(normalizedAgent);

  const projectIds = await getAccessibleProjectIds(userId);

  // All completed jobs in the period, with cost + ticket id (for ship counts).
  const completedJobs = await prisma.job.findMany({
    where: {
      projectId: { in: projectIds },
      status: JobStatus.COMPLETED,
      completedAt: { gte: start, lte: endInclusive },
      ...(agentWhere ?? {}),
    },
    select: {
      command: true,
      completedAt: true,
      costUsd: true,
      ticketId: true,
    },
  });

  const buckets = emptyBuckets(start, end);

  for (const job of completedJobs) {
    if (!job.completedAt) continue;
    const key = bucketKeyForUtcDate(job.completedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.jobCount += 1;
    if (job.costUsd != null) {
      bucket.costSum += job.costUsd;
      bucket.costSeen = true;
    }
    if (job.command === 'ship') {
      bucket.shippedTicketIds.add(job.ticketId);
    }
  }

  const days: HeatmapDay[] = [];
  let totalJobs = 0;
  let totalShipped = 0;

  // Buckets were inserted in calendar order, but sort explicitly so the
  // response contract does not depend on Map iteration order.
  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!;
    const shippedCount = bucket.shippedTicketIds.size;
    days.push({
      date: key,
      jobCount: bucket.jobCount,
      totalCost: bucket.costSeen ? Math.round(bucket.costSum * 100) / 100 : null,
      ticketsShipped: shippedCount,
    });
    totalJobs += bucket.jobCount;
    totalShipped += shippedCount;
  }

  return {
    period,
    totals: {
      jobs: totalJobs,
      ticketsShipped: totalShipped,
    },
    days,
    availableAgents,
    availableYears: getAvailableYears(userCreatedAt, now),
    filters: {
      period: filters.period,
      agent: normalizedAgent,
    },
    generatedAt: now.toISOString(),
  };
}
