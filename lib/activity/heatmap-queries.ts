import { JobStatus, type Agent, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  type BucketJobInput,
  bucketJobsByLocalDay,
  buildAgentOptions,
  buildGridSkeleton,
  buildPeriodLabel,
  buildYearOptions,
  computeYearRange,
} from './heatmap-bucketing';
import type {
  HeatmapAgentFilter,
  HeatmapResponse,
  HeatmapYearSelection,
} from './heatmap-types';

const HEATMAP_JOB_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

export interface HeatmapQueryFilters {
  year: HeatmapYearSelection;
  agent: HeatmapAgentFilter;
  timezone: string;
}

function buildEffectiveAgentTicketWhere(
  agent: HeatmapAgentFilter
): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
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

async function getAccessibleProjectIds(viewerId: string): Promise<number[]> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId: viewerId }, { members: { some: { userId: viewerId } } }],
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

async function getHistoricalAgentCounts(
  projectIds: number[]
): Promise<Map<Agent, number>> {
  if (projectIds.length === 0) return new Map();

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId: { in: projectIds },
      jobs: { some: { status: { in: HEATMAP_JOB_STATUSES } } },
    },
    select: {
      agent: true,
      project: { select: { defaultAgent: true } },
      _count: { select: { jobs: true } },
    },
  });

  const counts = new Map<Agent, number>();
  for (const ticket of tickets) {
    const effective = (ticket.agent ?? ticket.project.defaultAgent) as Agent;
    counts.set(effective, (counts.get(effective) ?? 0) + ticket._count.jobs);
  }
  return counts;
}

export async function getHeatmapData(
  viewerId: string,
  viewerCreatedAt: Date,
  filters: HeatmapQueryFilters
): Promise<HeatmapResponse> {
  const now = new Date();
  const projectIds = await getAccessibleProjectIds(viewerId);

  const yearOptions = buildYearOptions(viewerCreatedAt, now);
  const historicalCounts = await getHistoricalAgentCounts(projectIds);
  const agentOptions = buildAgentOptions(historicalCounts);

  const yearRange = computeYearRange(filters.year, now);
  const gridRange = buildGridSkeleton(yearRange.startDate, yearRange.endDate);

  const startBoundary = new Date(`${yearRange.startDate}T00:00:00.000Z`);
  // endExclusive = end + 2 days to safely include late-UTC jobs that fall in local-tz end day
  const endBoundaryExclusive = new Date(`${yearRange.endDate}T00:00:00.000Z`);
  endBoundaryExclusive.setUTCDate(endBoundaryExclusive.getUTCDate() + 2);

  const ticketWhere: Prisma.TicketWhereInput = {
    projectId: { in: projectIds },
    ...buildEffectiveAgentTicketWhere(filters.agent),
  };

  let jobs: Array<{
    ticketId: number;
    command: string;
    status: JobStatus;
    completedAt: Date | null;
    costUsd: number | null;
  }> = [];

  if (projectIds.length > 0) {
    jobs = await prisma.job.findMany({
      where: {
        projectId: { in: projectIds },
        status: { in: HEATMAP_JOB_STATUSES },
        completedAt: {
          gte: startBoundary,
          lt: endBoundaryExclusive,
        },
        ticket: { is: ticketWhere },
      },
      select: {
        ticketId: true,
        command: true,
        status: true,
        completedAt: true,
        costUsd: true,
      },
    });
  }

  const inputs: BucketJobInput[] = jobs
    .filter((j): j is typeof j & { completedAt: Date } => j.completedAt !== null)
    .map((j) => ({
      ticketId: j.ticketId,
      command: j.command,
      status: j.status === JobStatus.COMPLETED ? 'COMPLETED' : 'FAILED',
      completedAt: j.completedAt,
      costUsd: j.costUsd,
    }));

  const days = bucketJobsByLocalDay(inputs, filters.timezone, yearRange);

  let totalJobs = 0;
  let ticketsShipped = 0;
  for (const day of days) {
    totalJobs += day.jobCount;
    ticketsShipped += day.ticketsShipped;
  }

  return {
    filters: {
      year: filters.year,
      agent: filters.agent,
      timezone: filters.timezone,
    },
    range: gridRange,
    days,
    counters: {
      totalJobs,
      ticketsShipped,
      periodLabel: buildPeriodLabel(filters.year),
    },
    agentOptions,
    yearOptions,
    generatedAt: now.toISOString(),
  };
}
