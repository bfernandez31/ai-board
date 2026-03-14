/**
 * Analytics Query Helpers
 *
 * Prisma query functions for fetching and aggregating analytics data.
 * All queries are read-only against existing Job and Ticket tables.
 */

import { JobStatus } from '@prisma/client';
import type { Prisma, Stage, WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type {
  AgentOption,
  AnalyticsData,
  AnalyticsFilters,
  CacheMetrics,
  CompletionMetric,
  CostDataPoint,
  NamedAgent,
  OverviewMetrics,
  StageCost,
  StageKey,
  TicketOutcomeFilter,
  TokenBreakdown,
  ToolUsage,
  WeeklyVelocity,
  WorkflowBreakdown,
} from './types';
import {
  DEFAULT_ANALYTICS_FILTERS,
  aggregateTools,
  calculateTrend,
  formatDateForGrouping,
  getDateRangeStart,
  getGranularity,
  getISOWeek,
  getPreviousPeriodStart,
  getRangeLabel,
  getStageFromCommand,
  hasAnalyticsData,
} from './aggregations';

const COMPLETED_TICKET_STAGES: Stage[] = ['SHIP', 'CLOSED'];
const JOB_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') {
    return undefined;
  }

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

function buildOutcomeStages(outcome: TicketOutcomeFilter): Stage[] {
  switch (outcome) {
    case 'shipped':
      return ['SHIP'];
    case 'closed':
      return ['CLOSED'];
    case 'all-completed':
      return COMPLETED_TICKET_STAGES;
  }
}

function buildTicketMembershipWhere(filters: AnalyticsFilters): Prisma.TicketWhereInput {
  const clauses: Prisma.TicketWhereInput[] = [
    {
      stage: {
        in: buildOutcomeStages(filters.outcome),
      },
    },
  ];

  const agentWhere = buildEffectiveAgentWhere(filters.agent);
  if (agentWhere) {
    clauses.push(agentWhere);
  }

  return clauses.length === 1 ? clauses[0]! : { AND: clauses };
}

function buildTicketRangeWhere(filters: AnalyticsFilters, now: Date): Prisma.TicketWhereInput {
  const rangeStart = getDateRangeStart(filters.range, now);
  const agentWhere = buildEffectiveAgentWhere(filters.agent);

  const rangeWhere =
    filters.outcome === 'all-completed'
      ? {
          OR: [
            {
              stage: 'SHIP' as const,
              ...(rangeStart ? { updatedAt: { gte: rangeStart } } : {}),
            },
            {
              stage: 'CLOSED' as const,
              closedAt: rangeStart ? { gte: rangeStart } : { not: null },
            },
          ],
        }
      : filters.outcome === 'shipped'
        ? {
            stage: 'SHIP' as const,
            ...(rangeStart ? { updatedAt: { gte: rangeStart } } : {}),
          }
        : {
            stage: 'CLOSED' as const,
            closedAt: rangeStart ? { gte: rangeStart } : { not: null },
          };

  if (!agentWhere) {
    return rangeWhere;
  }

  return {
    AND: [rangeWhere, agentWhere],
  };
}

function buildJobWhere(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date,
  statuses: JobStatus[] = JOB_STATUSES
): Prisma.JobWhereInput {
  const rangeStart = getDateRangeStart(filters.range, now);

  return {
    projectId,
    status: { in: statuses },
    ticket: {
      is: buildTicketMembershipWhere(filters),
    },
    ...(rangeStart ? { completedAt: { gte: rangeStart } } : {}),
  };
}

function buildPreviousPeriodJobWhere(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Prisma.JobWhereInput | null {
  const rangeStart = getDateRangeStart(filters.range, now);
  const previousPeriodStart = getPreviousPeriodStart(filters.range, now);

  if (!rangeStart || !previousPeriodStart) {
    return null;
  }

  return {
    projectId,
    status: { in: JOB_STATUSES },
    ticket: {
      is: buildTicketMembershipWhere(filters),
    },
    completedAt: {
      gte: previousPeriodStart,
      lt: rangeStart,
    },
  };
}

async function getAvailableAgents(projectId: number): Promise<AgentOption[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: { in: COMPLETED_TICKET_STAGES },
      jobs: {
        some: {},
      },
    },
    select: {
      agent: true,
      project: {
        select: {
          defaultAgent: true,
        },
      },
      _count: {
        select: {
          jobs: true,
        },
      },
    },
  });

  const counts = new Map<NamedAgent, number>([
    ['CLAUDE', 0],
    ['CODEX', 0],
  ]);

  for (const ticket of tickets) {
    const effectiveAgent = (ticket.agent ?? ticket.project.defaultAgent) as NamedAgent;
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + ticket._count.jobs);
  }

  const options: AgentOption[] = [
    {
      value: 'all',
      label: 'All agents',
      jobCount: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
      isDefault: true,
    },
  ];

  for (const agent of ['CLAUDE', 'CODEX'] as const) {
    const jobCount = counts.get(agent) ?? 0;
    if (jobCount > 0) {
      options.push({
        value: agent,
        label: agent === 'CLAUDE' ? 'Claude' : 'Codex',
        jobCount,
        isDefault: false,
      });
    }
  }

  return options;
}

async function getCompletionMetrics(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<Pick<OverviewMetrics, 'ticketsShipped' | 'ticketsClosed'>> {
  const rangeStart = getDateRangeStart(filters.range, now);
  const agentWhere = buildEffectiveAgentWhere(filters.agent);
  const label = getRangeLabel(filters.range);

  const shippedWhere: Prisma.TicketWhereInput = {
    projectId,
    stage: 'SHIP',
    ...(rangeStart ? { updatedAt: { gte: rangeStart } } : {}),
    ...(agentWhere ? agentWhere : {}),
  };

  const closedWhere: Prisma.TicketWhereInput = {
    projectId,
    stage: 'CLOSED',
    closedAt: rangeStart ? { gte: rangeStart } : { not: null },
    ...(agentWhere ? agentWhere : {}),
  };

  const [shippedCount, closedCount] = await Promise.all([
    filters.outcome === 'closed' ? Promise.resolve(0) : prisma.ticket.count({ where: shippedWhere }),
    filters.outcome === 'shipped' ? Promise.resolve(0) : prisma.ticket.count({ where: closedWhere }),
  ]);

  const toMetric = (count: number): CompletionMetric => ({
    count,
    label,
  });

  return {
    ticketsShipped: toMetric(shippedCount),
    ticketsClosed: toMetric(closedCount),
  };
}

async function getOverviewMetrics(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<OverviewMetrics> {
  const currentJobWhere = buildJobWhere(projectId, filters, now);
  const previousJobWhere = buildPreviousPeriodJobWhere(projectId, filters, now);

  const [currentJobs, previousJobs, completionMetrics] = await Promise.all([
    prisma.job.findMany({
      where: currentJobWhere,
      select: {
        status: true,
        costUsd: true,
        durationMs: true,
      },
    }),
    previousJobWhere
      ? prisma.job.findMany({
          where: previousJobWhere,
          select: {
            costUsd: true,
          },
        })
      : Promise.resolve([]),
    getCompletionMetrics(projectId, filters, now),
  ]);

  const completedJobs = currentJobs.filter((job) => job.status === 'COMPLETED');
  const totalCost = completedJobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
  const previousCost = previousJobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
  const successRate =
    currentJobs.length > 0 ? (completedJobs.length / currentJobs.length) * 100 : 0;
  const avgDuration =
    completedJobs.length > 0
      ? Math.round(
          completedJobs.reduce((sum, job) => sum + (job.durationMs ?? 0), 0) / completedJobs.length
        )
      : 0;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costTrend: Math.round(calculateTrend(totalCost, previousCost) * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    avgDuration,
    ...completionMetrics,
  };
}

async function getCostOverTime(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<CostDataPoint[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ...buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED]),
      costUsd: { not: null },
    },
    select: {
      completedAt: true,
      costUsd: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const grouped = new Map<string, number>();
  const granularity = getGranularity(filters.range);

  for (const job of jobs) {
    if (!job.completedAt) continue;
    const key = formatDateForGrouping(job.completedAt, granularity);
    grouped.set(key, (grouped.get(key) ?? 0) + (job.costUsd ?? 0));
  }

  return Array.from(grouped.entries())
    .map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getCostByStage(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<StageCost[]> {
  const jobs = await prisma.job.findMany({
    where: {
      ...buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED]),
      costUsd: { not: null },
    },
    select: {
      command: true,
      costUsd: true,
    },
  });

  const stageCosts = new Map<StageKey, number>();
  for (const job of jobs) {
    const stage = getStageFromCommand(job.command);
    if (stage) {
      stageCosts.set(stage, (stageCosts.get(stage) ?? 0) + (job.costUsd ?? 0));
    }
  }

  const totalCost = Array.from(stageCosts.values()).reduce((sum, cost) => sum + cost, 0);
  const stages: StageKey[] = ['BUILD', 'SPECIFY', 'PLAN', 'VERIFY'];

  return stages
    .map((stage) => {
      const cost = stageCosts.get(stage) ?? 0;
      return {
        stage,
        cost: Math.round(cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 1000) / 10 : 0,
      };
    })
    .filter((stage) => stage.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}

async function getTokenUsage(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<TokenBreakdown> {
  const result = await prisma.job.aggregate({
    where: {
      ...buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED]),
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
    },
  });

  return {
    inputTokens: result._sum.inputTokens ?? 0,
    outputTokens: result._sum.outputTokens ?? 0,
    cacheTokens: (result._sum.cacheReadTokens ?? 0) + (result._sum.cacheCreationTokens ?? 0),
  };
}

async function getCacheEfficiency(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<CacheMetrics> {
  const tokenUsage = await getTokenUsage(projectId, filters, now);
  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens + tokenUsage.cacheTokens;
  const savingsPercentage =
    totalTokens > 0 ? Math.round((tokenUsage.cacheTokens / totalTokens) * 1000) / 10 : 0;
  const estimatedSavingsUsd = Math.round(tokenUsage.cacheTokens * 0.0000027 * 100) / 100;

  return {
    totalTokens,
    cacheTokens: tokenUsage.cacheTokens,
    savingsPercentage,
    estimatedSavingsUsd,
  };
}

async function getTopTools(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<ToolUsage[]> {
  const jobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED]),
    select: {
      toolsUsed: true,
    },
  });

  return aggregateTools(jobs.map((job) => job.toolsUsed));
}

async function getWorkflowDistribution(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<WorkflowBreakdown[]> {
  const tickets = await prisma.ticket.groupBy({
    by: ['workflowType'],
    where: {
      projectId,
      ...buildTicketRangeWhere(filters, now),
    },
    _count: true,
  });

  const total = tickets.reduce((sum, ticket) => sum + ticket._count, 0);

  return tickets
    .map((ticket) => ({
      type: ticket.workflowType as WorkflowType,
      count: ticket._count,
      percentage: total > 0 ? Math.round((ticket._count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

async function getVelocityData(
  projectId: number,
  filters: AnalyticsFilters,
  now: Date
): Promise<WeeklyVelocity[]> {
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      ...buildTicketRangeWhere(filters, now),
    },
    select: {
      stage: true,
      updatedAt: true,
      closedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  const weekly = new Map<string, number>();

  for (const ticket of tickets) {
    const eventDate = ticket.stage === 'CLOSED' ? ticket.closedAt : ticket.updatedAt;
    if (!eventDate) continue;
    const year = eventDate.getFullYear();
    const week = getISOWeek(eventDate);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;
    weekly.set(key, (weekly.get(key) ?? 0) + 1);
  }

  return Array.from(weekly.entries())
    .map(([week, ticketsShipped]) => ({ week, ticketsShipped }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function normalizeFilters(
  filters: Partial<AnalyticsFilters> = {},
  availableAgents?: AgentOption[]
): AnalyticsFilters {
  const normalized: AnalyticsFilters = {
    range: filters.range ?? DEFAULT_ANALYTICS_FILTERS.range,
    outcome: filters.outcome ?? DEFAULT_ANALYTICS_FILTERS.outcome,
    agent: filters.agent ?? DEFAULT_ANALYTICS_FILTERS.agent,
  };

  if (
    normalized.agent !== 'all' &&
    availableAgents &&
    !availableAgents.some((option) => option.value === normalized.agent)
  ) {
    normalized.agent = 'all';
  }

  return normalized;
}

export async function getAnalyticsData(
  projectId: number,
  filters: Partial<AnalyticsFilters> = DEFAULT_ANALYTICS_FILTERS
): Promise<AnalyticsData> {
  const now = new Date();
  const availableAgents = await getAvailableAgents(projectId);
  const normalizedFilters = normalizeFilters(filters, availableAgents);

  const filteredJobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, normalizedFilters, now),
    select: {
      status: true,
      costUsd: true,
      inputTokens: true,
    },
  });

  const hasData = hasAnalyticsData(filteredJobs);
  const jobCount = filteredJobs.length;

  const [
    overview,
    costOverTime,
    costByStage,
    tokenUsage,
    cacheEfficiency,
    topTools,
    workflowDistribution,
    velocity,
  ] = await Promise.all([
    getOverviewMetrics(projectId, normalizedFilters, now),
    getCostOverTime(projectId, normalizedFilters, now),
    getCostByStage(projectId, normalizedFilters, now),
    getTokenUsage(projectId, normalizedFilters, now),
    getCacheEfficiency(projectId, normalizedFilters, now),
    getTopTools(projectId, normalizedFilters, now),
    getWorkflowDistribution(projectId, normalizedFilters, now),
    getVelocityData(projectId, normalizedFilters, now),
  ]);

  return {
    overview,
    costOverTime,
    costByStage,
    tokenUsage,
    cacheEfficiency,
    topTools,
    workflowDistribution,
    velocity,
    filters: normalizedFilters,
    availableAgents,
    generatedAt: now.toISOString(),
    jobCount,
    hasData,
  };
}
