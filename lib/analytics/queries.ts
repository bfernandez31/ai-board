import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  calculateTrend,
  formatDateForGrouping,
  getDateRangeStart,
  getGranularity,
  getIncludedStages,
  getISOWeek,
  getPreviousPeriodStart,
  getStageFromCommand,
  hasAnalyticsData,
  aggregateTools,
} from './aggregations';
import {
  getAgentLabel,
  getPeriodLabel,
  type AgentOption,
  type AgentScope,
  type AnalyticsData,
  type AnalyticsFilterState,
  type AnalyticsQueryState,
  type CacheMetrics,
  type CostDataPoint,
  type OverviewMetrics,
  type StageCost,
  type StageKey,
  type TimeRange,
  type TokenBreakdown,
  type ToolUsage,
  type WeeklyVelocity,
  type WorkflowBreakdown,
} from './types';

interface MetricFilters {
  timeRange: TimeRange;
  statusScope: AnalyticsFilterState['statusScope'];
  agentScope: AgentScope;
}

interface AggregatedTokenUsage {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  inputTokens: number;
  outputTokens: number;
}

function getAgentWhere(agentScope: AgentScope): Prisma.TicketWhereInput | undefined {
  if (agentScope === 'all') {
    return undefined;
  }

  return {
    OR: [
      { agent: agentScope },
      {
        agent: null,
        project: {
          defaultAgent: agentScope,
        },
      },
    ],
  };
}

function buildJobWhere(
  projectId: number,
  filters: MetricFilters,
  rangeStart: Date | null,
  statuses?: Array<'COMPLETED' | 'FAILED'>
): Prisma.JobWhereInput {
  return {
    projectId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(rangeStart ? { completedAt: { gte: rangeStart } } : {}),
    ticket: {
      stage: { in: getIncludedStages(filters.statusScope) },
      ...(getAgentWhere(filters.agentScope) ?? {}),
    },
  };
}

function buildTicketWhere(
  projectId: number,
  filters: MetricFilters,
  rangeStart: Date | null
): Prisma.TicketWhereInput {
  return {
    projectId,
    stage: { in: getIncludedStages(filters.statusScope) },
    ...(rangeStart ? { updatedAt: { gte: rangeStart } } : {}),
    ...(getAgentWhere(filters.agentScope) ?? {}),
  };
}

async function getProjectDefaultAgent(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { defaultAgent: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project.defaultAgent;
}

async function getAvailableAgents(projectId: number): Promise<AgentOption[]> {
  const defaultAgent = await getProjectDefaultAgent(projectId);
  const jobs = await prisma.job.findMany({
    where: { projectId },
    select: {
      ticket: {
        select: {
          agent: true,
        },
      },
    },
  });

  const counts = new Map<'CLAUDE' | 'CODEX', number>();
  for (const job of jobs) {
    const effectiveAgent = (job.ticket.agent ?? defaultAgent) as 'CLAUDE' | 'CODEX';
    counts.set(effectiveAgent, (counts.get(effectiveAgent) ?? 0) + 1);
  }

  return (['CLAUDE', 'CODEX'] as const)
    .filter((agent) => (counts.get(agent) ?? 0) > 0)
    .map((agent) => ({
      value: agent,
      label: getAgentLabel(agent),
      jobCount: counts.get(agent) ?? 0,
    }));
}

function resolveFilters(
  query: AnalyticsQueryState,
  availableAgents: AgentOption[]
): AnalyticsFilterState {
  if (query.agentScope !== 'all' && !availableAgents.some((agent) => agent.value === query.agentScope)) {
    throw new Error('Invalid analytics filter');
  }

  return {
    timeRange: query.range,
    statusScope: query.statusScope,
    agentScope: query.agentScope,
    periodLabel: getPeriodLabel(query.range),
  };
}

async function getTicketStatusCounts(
  projectId: number,
  filters: AnalyticsFilterState,
  rangeStart: Date | null
) {
  const includedStages = getIncludedStages(filters.statusScope);
  const sharedWhere = {
    projectId,
    ...(getAgentWhere(filters.agentScope) ?? {}),
  } satisfies Prisma.TicketWhereInput;

  const shippedCount = includedStages.includes('SHIP')
    ? await prisma.ticket.count({
        where: {
          ...sharedWhere,
          stage: 'SHIP',
          ...(rangeStart ? { updatedAt: { gte: rangeStart } } : {}),
        },
      })
    : 0;

  const closedCount = includedStages.includes('CLOSED')
    ? await prisma.ticket.count({
        where: {
          ...sharedWhere,
          stage: 'CLOSED',
          ...(rangeStart
            ? {
                OR: [{ closedAt: { gte: rangeStart } }, { closedAt: null, updatedAt: { gte: rangeStart } }],
              }
            : {}),
        },
      })
    : 0;

  return { shippedCount, closedCount };
}

async function getOverviewMetrics(
  projectId: number,
  filters: AnalyticsFilterState,
  now: Date
): Promise<OverviewMetrics> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);
  const prevRangeStart = getPreviousPeriodStart(filters.timeRange, now);

  const currentJobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED', 'FAILED']),
    select: {
      status: true,
      costUsd: true,
      durationMs: true,
    },
  });

  const previousJobs = prevRangeStart
    ? await prisma.job.findMany({
        where: {
          ...buildJobWhere(projectId, filters, prevRangeStart, ['COMPLETED', 'FAILED']),
          completedAt: {
            gte: prevRangeStart,
            lt: rangeStart ?? now,
          },
        },
        select: {
          costUsd: true,
        },
      })
    : [];

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

  const { shippedCount, closedCount } = await getTicketStatusCounts(projectId, filters, rangeStart);

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costTrend: Math.round(calculateTrend(totalCost, previousCost) * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    avgDuration,
    ticketsShipped: shippedCount,
    ticketsClosed: closedCount,
    ticketPeriodLabel: filters.periodLabel,
  };
}

async function getCostOverTime(
  projectId: number,
  filters: AnalyticsFilterState,
  now: Date
): Promise<CostDataPoint[]> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);
  const granularity = getGranularity(filters.timeRange);

  const jobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED']),
    select: {
      completedAt: true,
      costUsd: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const grouped = new Map<string, number>();
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
  filters: AnalyticsFilterState,
  now: Date
): Promise<StageCost[]> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);

  const jobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED']),
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
  filters: AnalyticsFilterState,
  now: Date
): Promise<AggregatedTokenUsage> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);

  const result = await prisma.job.aggregate({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED']),
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
    cacheReadTokens: result._sum.cacheReadTokens ?? 0,
    cacheCreationTokens: result._sum.cacheCreationTokens ?? 0,
  };
}

function toTokenBreakdown(tokenUsage: AggregatedTokenUsage): TokenBreakdown {
  return {
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    cacheTokens: tokenUsage.cacheReadTokens + tokenUsage.cacheCreationTokens,
  };
}

function toCacheMetrics(tokenUsage: AggregatedTokenUsage): CacheMetrics {
  const cacheTokens = tokenUsage.cacheReadTokens + tokenUsage.cacheCreationTokens;
  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens + cacheTokens;
  const savingsPercentage =
    totalTokens > 0 ? Math.round((cacheTokens / totalTokens) * 1000) / 10 : 0;

  return {
    totalTokens,
    cacheTokens,
    savingsPercentage,
    estimatedSavingsUsd: Math.round(cacheTokens * 0.0000027 * 100) / 100,
  };
}

async function getTopTools(
  projectId: number,
  filters: AnalyticsFilterState,
  now: Date
): Promise<ToolUsage[]> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);

  const jobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED']),
    select: {
      toolsUsed: true,
    },
  });

  return aggregateTools(jobs.map((job) => job.toolsUsed));
}

async function getWorkflowDistribution(
  projectId: number,
  filters: AnalyticsFilterState,
  now: Date
): Promise<WorkflowBreakdown[]> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);
  const tickets = await prisma.ticket.groupBy({
    by: ['workflowType'],
    where: buildTicketWhere(projectId, filters, rangeStart),
    _count: true,
  });

  const total = tickets.reduce((sum, ticket) => sum + ticket._count, 0);

  return tickets
    .map((ticket) => ({
      type: ticket.workflowType as 'FULL' | 'QUICK' | 'CLEAN',
      count: ticket._count,
      percentage: total > 0 ? Math.round((ticket._count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

async function getVelocityData(
  projectId: number,
  filters: AnalyticsFilterState,
  now: Date
): Promise<WeeklyVelocity[]> {
  const rangeStart = getDateRangeStart(filters.timeRange, now);

  const tickets = await prisma.ticket.findMany({
    where: buildTicketWhere(projectId, filters, rangeStart),
    select: {
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  const weekly = new Map<string, number>();
  for (const ticket of tickets) {
    const year = ticket.updatedAt.getFullYear();
    const week = getISOWeek(ticket.updatedAt);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;
    weekly.set(key, (weekly.get(key) ?? 0) + 1);
  }

  return Array.from(weekly.entries())
    .map(([week, ticketsShipped]) => ({ week, ticketsShipped }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export async function getAnalyticsData(
  projectId: number,
  query: AnalyticsQueryState
): Promise<AnalyticsData> {
  const now = new Date();
  const availableAgents = await getAvailableAgents(projectId);
  const filters = resolveFilters(query, availableAgents);
  const rangeStart = getDateRangeStart(filters.timeRange, now);

  const allJobs = await prisma.job.findMany({
    where: buildJobWhere(projectId, filters, rangeStart, ['COMPLETED', 'FAILED']),
    select: {
      status: true,
      costUsd: true,
      inputTokens: true,
    },
  });

  const hasData = hasAnalyticsData(allJobs);
  const jobCount = allJobs.length;

  const [
    overview,
    costOverTime,
    costByStage,
    aggregatedTokenUsage,
    topTools,
    workflowDistribution,
    velocity,
  ] = await Promise.all([
    getOverviewMetrics(projectId, filters, now),
    getCostOverTime(projectId, filters, now),
    getCostByStage(projectId, filters, now),
    getTokenUsage(projectId, filters, now),
    getTopTools(projectId, filters, now),
    getWorkflowDistribution(projectId, filters, now),
    getVelocityData(projectId, filters, now),
  ]);

  const tokenUsage = toTokenBreakdown(aggregatedTokenUsage);
  const cacheEfficiency = toCacheMetrics(aggregatedTokenUsage);

  return {
    filters,
    availableAgents,
    overview,
    costOverTime,
    costByStage,
    tokenUsage,
    cacheEfficiency,
    topTools,
    workflowDistribution,
    velocity,
    timeRange: filters.timeRange,
    generatedAt: now.toISOString(),
    jobCount,
    hasData,
  };
}
