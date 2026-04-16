/**
 * Heatmap query layer.
 *
 * Builds a `HeatmapData` payload for the signed-in user by reading
 * terminal jobs across all accessible projects, bucketing them by
 * day, and computing intensity thresholds.
 */

import { JobStatus, type Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getAccessibleProjectIdsForUser } from '@/lib/db/projects';
import {
  ALL_AGENTS,
  AGENT_LABELS,
  resolveEffectiveAgent,
} from '@/app/lib/utils/agent-resolution';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapData,
  HeatmapDayCell,
  HeatmapFilters,
  HeatmapPeriod,
} from './types';
import {
  buildPeriodOptions,
  computeIntensityThresholds,
  enumerateDateKeys,
  formatDateKey,
  getIntensityLevel,
  getPeriodBounds,
} from './aggregations';

const TERMINAL_JOB_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

interface DailyAggregate {
  jobCount: number;
  shippedTicketIds: Set<number>;
  totalCost: number | null;
}

function emptyAggregate(): DailyAggregate {
  return { jobCount: 0, shippedTicketIds: new Set(), totalCost: null };
}

function addCost(current: number | null, added: number | null | undefined): number | null {
  if (added === null || added === undefined) {
    return current;
  }
  return (current ?? 0) + added;
}

function normalizePeriod(
  raw: string | null | undefined,
  userCreatedYear: number,
  currentYear: number
): HeatmapPeriod {
  if (!raw || raw === 'last-12-months') {
    return 'last-12-months';
  }
  if (/^\d{4}$/.test(raw)) {
    const year = Number(raw);
    if (year >= userCreatedYear && year <= currentYear) {
      return raw as `${number}`;
    }
  }
  return 'last-12-months';
}

function normalizeAgent(raw: string | null | undefined): HeatmapAgentFilter {
  if (raw && raw !== 'all' && ALL_AGENTS.includes(raw as Agent)) {
    return raw as Agent;
  }
  return 'all';
}

export async function getHeatmapData(
  userId: string,
  rawFilters: { period?: string | null; agent?: string | null } = {}
): Promise<HeatmapData> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  const userCreatedAt = user?.createdAt ?? now;

  const period = normalizePeriod(
    rawFilters.period,
    userCreatedAt.getFullYear(),
    now.getFullYear()
  );
  const agentFilter = normalizeAgent(rawFilters.agent);
  const filters: HeatmapFilters = { period, agent: agentFilter };

  const bounds = getPeriodBounds(period, now);
  const projectIds = await getAccessibleProjectIdsForUser(userId);

  const jobs = projectIds.length
    ? await prisma.job.findMany({
        where: {
          projectId: { in: projectIds },
          status: { in: TERMINAL_JOB_STATUSES },
          completedAt: { gte: bounds.startDate, lte: bounds.endDate },
        },
        select: {
          completedAt: true,
          command: true,
          status: true,
          costUsd: true,
          ticketId: true,
          ticket: {
            select: {
              agent: true,
              project: { select: { defaultAgent: true } },
            },
          },
        },
      })
    : [];

  const unfilteredAgentCounts = new Map<Agent, number>();
  for (const job of jobs) {
    const effective = resolveEffectiveAgent(
      job.ticket.agent,
      job.ticket.project.defaultAgent
    );
    unfilteredAgentCounts.set(effective, (unfilteredAgentCounts.get(effective) ?? 0) + 1);
  }

  const distinctAgents = Array.from(unfilteredAgentCounts.keys());
  const availableAgents: HeatmapAgentOption[] =
    distinctAgents.length >= 2
      ? distinctAgents
          .map((agent) => ({
            value: agent,
            label: AGENT_LABELS[agent],
            jobCount: unfilteredAgentCounts.get(agent) ?? 0,
          }))
          .sort((a, b) => {
            if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
            return a.value.localeCompare(b.value);
          })
      : [];

  const filteredJobs =
    agentFilter === 'all'
      ? jobs
      : jobs.filter(
          (job) =>
            resolveEffectiveAgent(job.ticket.agent, job.ticket.project.defaultAgent) ===
            agentFilter
        );

  const dailyByDate = new Map<string, DailyAggregate>();
  for (const job of filteredJobs) {
    if (!job.completedAt) continue;
    const key = formatDateKey(job.completedAt);
    const agg = dailyByDate.get(key) ?? emptyAggregate();

    agg.jobCount += 1;
    agg.totalCost = addCost(agg.totalCost, job.costUsd);

    if (job.command === 'ship' && job.status === JobStatus.COMPLETED) {
      agg.shippedTicketIds.add(job.ticketId);
    }

    dailyByDate.set(key, agg);
  }

  const nonZeroDailyCounts: number[] = [];
  for (const aggregate of dailyByDate.values()) {
    if (aggregate.jobCount > 0) {
      nonZeroDailyCounts.push(aggregate.jobCount);
    }
  }
  const thresholds = computeIntensityThresholds(nonZeroDailyCounts);

  const gridDateKeys = enumerateDateKeys(bounds.gridStart, bounds.gridEnd);
  const startTime = bounds.startDate.getTime();
  const endTime = bounds.endDate.getTime();

  const days: HeatmapDayCell[] = gridDateKeys.map((key) => {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    const cellDate = new Date(y, m - 1, d);
    const inPeriod =
      cellDate.getTime() >= startTime && cellDate.getTime() <= endTime;

    const aggregate = dailyByDate.get(key);
    const jobCount = aggregate?.jobCount ?? 0;
    const shippedTicketCount = aggregate?.shippedTicketIds.size ?? 0;
    const totalCost = aggregate?.totalCost ?? null;
    const intensityLevel = getIntensityLevel(jobCount, thresholds);

    return {
      date: key,
      inPeriod,
      jobCount,
      shippedTicketCount,
      totalCost,
      intensityLevel,
    };
  });

  const totals = days.reduce(
    (acc, cell) => {
      if (!cell.inPeriod) return acc;
      acc.jobCount += cell.jobCount;
      acc.shippedTicketCount += cell.shippedTicketCount;
      return acc;
    },
    { jobCount: 0, shippedTicketCount: 0 }
  );

  return {
    filters,
    periodOptions: buildPeriodOptions(userCreatedAt, now),
    availableAgents,
    days,
    totals,
    intensityThresholds: thresholds,
    generatedAt: now.toISOString(),
  };
}
