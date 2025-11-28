import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  fetchJobsForAnalytics,
  fetchTicketsForVelocity,
  aggregateCostSummary,
  fetchWorkflowDistribution,
  countTicketsShippedThisMonth,
} from '@/lib/db/analytics-queries';
import {
  aggregateCostByStage,
  aggregateToolUsage,
} from '@/lib/analytics/aggregations';
import {
  calculateCacheEfficiency,
  calculateSuccessRate,
} from '@/lib/analytics/calculations';
import type {
  AnalyticsData,
  CostOverTimeDataPoint,
  VelocityDataPoint,
} from '@/lib/analytics/types';

const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
});

/**
 * GET /api/projects/[projectId]/analytics
 *
 * Fetches aggregated analytics data for a project
 * Includes cost metrics, success rates, token usage, tool usage, and velocity
 *
 * @returns AnalyticsData object with all dashboard metrics
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const paramsResult = RouteParamsSchema.safeParse(params);

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(params.projectId, 10);
    await verifyProjectAccess(projectId);

    // Calculate date ranges
    const now = new Date();
    const last30DaysStart = new Date(now);
    last30DaysStart.setDate(last30DaysStart.getDate() - 30);

    const previous30DaysStart = new Date(last30DaysStart);
    previous30DaysStart.setDate(previous30DaysStart.getDate() - 30);

    const last12WeeksStart = new Date(now);
    last12WeeksStart.setDate(last12WeeksStart.getDate() - 84);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all data in parallel
    const [
      jobs,
      previousJobs,
      velocityTickets,
      costSummary,
      workflowDist,
      ticketsShippedThisMonth,
    ] = await Promise.all([
      fetchJobsForAnalytics(projectId, last30DaysStart),
      fetchJobsForAnalytics(projectId, previous30DaysStart).then((allJobs) =>
        allJobs.filter((job) => job.completedAt && job.completedAt < last30DaysStart)
      ),
      fetchTicketsForVelocity(projectId, last12WeeksStart),
      aggregateCostSummary(projectId, last30DaysStart),
      fetchWorkflowDistribution(projectId),
      countTicketsShippedThisMonth(projectId, currentMonthStart),
    ]);

    // Calculate cost trend
    const currentCost = costSummary.totalCost;
    const previousCost = previousJobs.reduce(
      (sum, job) => sum + (job.costUsd ?? 0),
      0
    );
    const costTrendPercent =
      previousCost > 0
        ? ((currentCost - previousCost) / previousCost) * 100
        : null;

    // Calculate success rate
    const statusCounts = costSummary.statusCounts;
    const completedCount =
      statusCounts.find((s) => s.status === 'COMPLETED')?._count ?? 0;
    const failedCount =
      statusCounts.find((s) => s.status === 'FAILED')?._count ?? 0;
    const cancelledCount =
      statusCounts.find((s) => s.status === 'CANCELLED')?._count ?? 0;
    const successRatePercent = calculateSuccessRate(
      completedCount,
      failedCount,
      cancelledCount
    );

    // Aggregate token usage
    const tokenUsage = {
      inputTokens: jobs.reduce((sum, j) => sum + (j.inputTokens ?? 0), 0),
      outputTokens: jobs.reduce((sum, j) => sum + (j.outputTokens ?? 0), 0),
      cacheReadTokens: jobs.reduce((sum, j) => sum + (j.cacheReadTokens ?? 0), 0),
      cacheCreationTokens: jobs.reduce(
        (sum, j) => sum + (j.cacheCreationTokens ?? 0),
        0
      ),
      totalTokens: 0, // Will be calculated
    };
    tokenUsage.totalTokens =
      tokenUsage.inputTokens +
      tokenUsage.outputTokens +
      tokenUsage.cacheReadTokens +
      tokenUsage.cacheCreationTokens;

    // Calculate cache efficiency
    const cacheEfficiency = {
      efficiencyPercent: calculateCacheEfficiency(
        tokenUsage.inputTokens,
        tokenUsage.cacheReadTokens
      ),
      cacheReadTokens: tokenUsage.cacheReadTokens,
      freshInputTokens: tokenUsage.inputTokens,
      totalInputTokens: tokenUsage.inputTokens + tokenUsage.cacheReadTokens,
    };

    // Aggregate cost over time (daily)
    const costByDay = new Map<string, { cost: number; count: number }>();
    for (const job of jobs) {
      if (job.completedAt) {
        const dateKey = job.completedAt.toISOString().split('T')[0] ?? '';
        const existing = costByDay.get(dateKey) || { cost: 0, count: 0 };
        costByDay.set(dateKey, {
          cost: existing.cost + (job.costUsd ?? 0),
          count: existing.count + 1,
        });
      }
    }
    const costOverTime: CostOverTimeDataPoint[] = Array.from(
      costByDay.entries()
    ).map(([dateKey, { cost, count }]) => ({
      date: new Date(dateKey),
      costUsd: cost,
      jobCount: count,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Aggregate workflow distribution
    const totalTickets = workflowDist.reduce((sum, w) => sum + w._count, 0);
    const workflowDistribution = workflowDist.map((w) => ({
      workflowType: w.workflowType,
      ticketCount: w._count,
      percentage: totalTickets > 0 ? (w._count / totalTickets) * 100 : 0,
    })).sort((a, b) => b.percentage - a.percentage);

    // Aggregate velocity (weekly)
    const velocityByWeek = new Map<string, number>();
    for (const ticket of velocityTickets) {
      const weekStart = getISOWeekStart(ticket.updatedAt);
      const weekKey = weekStart.toISOString().split('T')[0] ?? '';
      velocityByWeek.set(weekKey, (velocityByWeek.get(weekKey) || 0) + 1);
    }
    const velocity: VelocityDataPoint[] = Array.from(
      velocityByWeek.entries()
    ).map(([weekKey, count]) => {
      const weekStart = new Date(weekKey);
      return {
        weekStartDate: weekStart,
        ticketsShipped: count,
        weekLabel: formatWeekLabel(weekStart),
      };
    }).sort((a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime());

    // Build response
    const analyticsData: AnalyticsData = {
      summary: {
        totalCostUsd: currentCost,
        costTrendPercent,
        successRatePercent,
        avgDurationMs: costSummary.avgDurationMs,
        ticketsShippedThisMonth,
      },
      costOverTime,
      costByStage: aggregateCostByStage(jobs),
      tokenUsage,
      topTools: aggregateToolUsage(jobs),
      cacheEfficiency,
      workflowDistribution,
      velocity,
    };

    return NextResponse.json(analyticsData, { status: 200 });
  } catch (error) {
    console.error('Error fetching analytics:', error);

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Gets the ISO week start date (Monday) for a given date
 */
function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(d.setDate(diff));
}

/**
 * Formats a week start date to a human-readable label
 */
function formatWeekLabel(weekStart: Date): string {
  const month = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const day = weekStart.getDate();
  return `Week of ${month} ${day}`;
}
