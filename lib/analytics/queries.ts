/**
 * Analytics Query Helpers
 *
 * Prisma query functions for fetching and aggregating analytics data.
 * All queries are read-only against existing Job and Ticket tables.
 */

import { prisma } from '@/lib/db/client';
import type {
  AnalyticsData,
  CacheMetrics,
  CostDataPoint,
  OverviewMetrics,
  StageCost,
  StageKey,
  StatusFilter,
  TimeRange,
  TokenBreakdown,
  ToolUsage,
  WeeklyVelocity,
  WorkflowBreakdown,
} from './types';
import {
  aggregateTools,
  calculateTrend,
  formatDateForGrouping,
  getDateRangeStart,
  getGranularity,
  getISOWeek,
  getPreviousPeriodStart,
  getStageFromCommand,
  getStagesFromStatus,
  hasAnalyticsData,
} from './aggregations';

/**
 * T010: Query helpers for different analytics sections
 */

/**
 * Get overview metrics for a project within a time range
 */
async function getOverviewMetrics(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[],
  agent: string | null
): Promise<OverviewMetrics> {
  const rangeStart = getDateRangeStart(range, now);
  const prevRangeStart = getPreviousPeriodStart(range, now);

  const stageFilter = { ticket: { stage: { in: stages } } };
  const agentFilter = agent ? { model: agent } : {};

  // Current period query
  const currentJobs = await prisma.job.findMany({
    where: {
      projectId,
      status: { in: ['COMPLETED', 'FAILED'] },
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
      ...stageFilter,
      ...agentFilter,
    },
    select: {
      status: true,
      costUsd: true,
      durationMs: true,
    },
  });

  // Previous period query (for trend calculation)
  const previousJobs = prevRangeStart
    ? await prisma.job.findMany({
        where: {
          projectId,
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: {
            gte: prevRangeStart,
            lt: rangeStart ?? now,
          },
          ...stageFilter,
          ...agentFilter,
        },
        select: {
          costUsd: true,
        },
      })
    : [];

  // Calculate metrics
  const completedJobs = currentJobs.filter((j) => j.status === 'COMPLETED');
  const totalCost = completedJobs.reduce((sum, j) => sum + (j.costUsd ?? 0), 0);
  const previousCost = previousJobs.reduce((sum, j) => sum + (j.costUsd ?? 0), 0);
  const successRate =
    currentJobs.length > 0 ? (completedJobs.length / currentJobs.length) * 100 : 0;
  const avgDuration =
    completedJobs.length > 0
      ? Math.round(
          completedJobs.reduce((sum, j) => sum + (j.durationMs ?? 0), 0) / completedJobs.length
        )
      : 0;

  // Tickets shipped in selected time range (fixed: was hardcoded to current month)
  const ticketsShipped = await prisma.ticket.count({
    where: {
      projectId,
      stage: 'SHIP',
      ...(rangeStart && { updatedAt: { gte: rangeStart } }),
    },
  });

  // Tickets closed in selected time range
  const ticketsClosed = await prisma.ticket.count({
    where: {
      projectId,
      stage: 'CLOSED',
      ...(rangeStart && { updatedAt: { gte: rangeStart } }),
    },
  });

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costTrend: Math.round(calculateTrend(totalCost, previousCost) * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    avgDuration,
    ticketsShipped,
    ticketsClosed,
  };
}

/**
 * Get cost over time data points
 */
async function getCostOverTime(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[],
  agent: string | null
): Promise<CostDataPoint[]> {
  const rangeStart = getDateRangeStart(range, now);
  const granularity = getGranularity(range);

  const jobs = await prisma.job.findMany({
    where: {
      projectId,
      status: 'COMPLETED',
      costUsd: { not: null },
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
      ticket: { stage: { in: stages } },
      ...(agent && { model: agent }),
    },
    select: {
      completedAt: true,
      costUsd: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  // Group by date/week
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

/**
 * Get cost breakdown by stage
 */
async function getCostByStage(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[],
  agent: string | null
): Promise<StageCost[]> {
  const rangeStart = getDateRangeStart(range, now);

  const jobs = await prisma.job.findMany({
    where: {
      projectId,
      status: 'COMPLETED',
      costUsd: { not: null },
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
      ticket: { stage: { in: stages } },
      ...(agent && { model: agent }),
    },
    select: {
      command: true,
      costUsd: true,
    },
  });

  // Group by stage
  const stageCosts = new Map<StageKey, number>();
  for (const job of jobs) {
    const stage = getStageFromCommand(job.command);
    if (stage) {
      stageCosts.set(stage, (stageCosts.get(stage) ?? 0) + (job.costUsd ?? 0));
    }
  }

  const totalCost = Array.from(stageCosts.values()).reduce((sum, cost) => sum + cost, 0);
  const stageKeys: StageKey[] = ['BUILD', 'SPECIFY', 'PLAN', 'VERIFY'];

  return stageKeys
    .map((stage) => {
      const cost = stageCosts.get(stage) ?? 0;
      return {
        stage,
        cost: Math.round(cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 1000) / 10 : 0,
      };
    })
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}

/**
 * Get token usage breakdown
 */
async function getTokenUsage(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[],
  agent: string | null
): Promise<TokenBreakdown> {
  const rangeStart = getDateRangeStart(range, now);

  const result = await prisma.job.aggregate({
    where: {
      projectId,
      status: 'COMPLETED',
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
      ticket: { stage: { in: stages } },
      ...(agent && { model: agent }),
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

/**
 * Compute cache efficiency metrics from pre-fetched token data
 */
function computeCacheEfficiency(tokenUsage: TokenBreakdown): CacheMetrics {
  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens + tokenUsage.cacheTokens;
  const savingsPercentage =
    totalTokens > 0 ? Math.round((tokenUsage.cacheTokens / totalTokens) * 1000) / 10 : 0;

  // Estimate savings: cache tokens at 10% of input token cost
  // Rough estimate: $3 per 1M input tokens, cache saves 90% of that
  const estimatedSavingsUsd = Math.round(tokenUsage.cacheTokens * 0.0000027 * 100) / 100;

  return {
    totalTokens,
    cacheTokens: tokenUsage.cacheTokens,
    savingsPercentage,
    estimatedSavingsUsd,
  };
}

/**
 * Get top tools usage
 */
async function getTopTools(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[],
  agent: string | null
): Promise<ToolUsage[]> {
  const rangeStart = getDateRangeStart(range, now);

  const jobs = await prisma.job.findMany({
    where: {
      projectId,
      status: 'COMPLETED',
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
      ticket: { stage: { in: stages } },
      ...(agent && { model: agent }),
    },
    select: {
      toolsUsed: true,
    },
  });

  return aggregateTools(jobs.map((j) => j.toolsUsed));
}

/**
 * Get workflow distribution
 */
async function getWorkflowDistribution(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[]
): Promise<WorkflowBreakdown[]> {
  const rangeStart = getDateRangeStart(range, now);

  const tickets = await prisma.ticket.groupBy({
    by: ['workflowType'],
    where: {
      projectId,
      stage: { in: stages },
      ...(rangeStart && { updatedAt: { gte: rangeStart } }),
    },
    _count: true,
  });

  const total = tickets.reduce((sum, t) => sum + t._count, 0);

  return tickets
    .map((t) => ({
      type: t.workflowType as 'FULL' | 'QUICK' | 'CLEAN',
      count: t._count,
      percentage: total > 0 ? Math.round((t._count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get velocity data (tickets shipped per week)
 */
async function getVelocityData(
  projectId: number,
  range: TimeRange,
  now: Date,
  stages: ('SHIP' | 'CLOSED')[]
): Promise<WeeklyVelocity[]> {
  const rangeStart = getDateRangeStart(range, now);

  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: { in: stages },
      ...(rangeStart && { updatedAt: { gte: rangeStart } }),
    },
    select: {
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  // Group by week
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

/**
 * Get distinct agent/model values for a project
 */
async function getAvailableAgents(projectId: number): Promise<string[]> {
  const results = await prisma.job.findMany({
    where: {
      projectId,
      model: { not: null },
    },
    select: { model: true },
    distinct: ['model'],
    orderBy: { model: 'asc' },
  });

  return results.map((r) => r.model).filter((m): m is string => m !== null);
}

export async function getAnalyticsData(
  projectId: number,
  range: TimeRange = '30d',
  status: StatusFilter = 'shipped',
  agent: string | null = null
): Promise<AnalyticsData> {
  const now = new Date();
  const rangeStart = getDateRangeStart(range, now);
  const stages = getStagesFromStatus(status);

  // Get all jobs for hasData check
  const allJobs = await prisma.job.findMany({
    where: {
      projectId,
      ...(rangeStart && { completedAt: { gte: rangeStart } }),
    },
    select: {
      status: true,
      costUsd: true,
      inputTokens: true,
    },
  });

  const hasData = hasAnalyticsData(allJobs);
  const jobCount = allJobs.length;

  // Fetch all metrics in parallel
  const [
    overview,
    costOverTime,
    costByStage,
    tokenUsage,
    topTools,
    workflowDistribution,
    velocity,
    availableAgents,
  ] = await Promise.all([
    getOverviewMetrics(projectId, range, now, stages, agent),
    getCostOverTime(projectId, range, now, stages, agent),
    getCostByStage(projectId, range, now, stages, agent),
    getTokenUsage(projectId, range, now, stages, agent),
    getTopTools(projectId, range, now, stages, agent),
    getWorkflowDistribution(projectId, range, now, stages),
    getVelocityData(projectId, range, now, stages),
    getAvailableAgents(projectId),
  ]);

  // Derive cache efficiency from already-fetched token data (no extra query)
  const cacheEfficiency = computeCacheEfficiency(tokenUsage);

  return {
    overview,
    costOverTime,
    costByStage,
    tokenUsage,
    cacheEfficiency,
    topTools,
    workflowDistribution,
    velocity,
    availableAgents,
    timeRange: range,
    generatedAt: now.toISOString(),
    jobCount,
    hasData,
  };
}
