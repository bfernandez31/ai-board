/**
 * Prisma queries for analytics data
 *
 * Database query functions for fetching job and ticket analytics data
 */

import { prisma } from './client';

/**
 * Fetches jobs for analytics with all telemetry fields
 * Filters by project and date range, only includes completed jobs
 *
 * @param projectId - Project ID to filter jobs
 * @param startDate - Start date for date range filter
 * @returns Jobs with telemetry data
 */
export async function fetchJobsForAnalytics(
  projectId: number,
  startDate: Date
) {
  return await prisma.job.findMany({
    where: {
      projectId,
      completedAt: { gte: startDate },
      status: 'COMPLETED',
    },
    select: {
      id: true,
      command: true,
      status: true,
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
      durationMs: true,
      toolsUsed: true,
      completedAt: true,
      startedAt: true,
    },
    orderBy: {
      completedAt: 'asc',
    },
  });
}

/**
 * Fetches tickets for velocity calculation
 * Returns tickets in SHIP stage within the specified date range
 *
 * @param projectId - Project ID to filter tickets
 * @param startDate - Start date for date range filter
 * @returns Tickets with updatedAt timestamp
 */
export async function fetchTicketsForVelocity(
  projectId: number,
  startDate: Date
) {
  return await prisma.ticket.findMany({
    where: {
      projectId,
      stage: 'SHIP',
      updatedAt: { gte: startDate },
    },
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });
}

/**
 * Aggregates cost summary for a project
 * Returns total cost and job counts by status
 *
 * @param projectId - Project ID to aggregate
 * @param startDate - Start date for date range filter
 * @returns Cost summary aggregation
 */
export async function aggregateCostSummary(
  projectId: number,
  startDate: Date
) {
  const [totalCost, statusCounts, avgDuration] = await Promise.all([
    // Total cost
    prisma.job.aggregate({
      where: {
        projectId,
        completedAt: { gte: startDate },
        status: 'COMPLETED',
      },
      _sum: {
        costUsd: true,
      },
    }),

    // Job counts by status (for success rate)
    prisma.job.groupBy({
      by: ['status'],
      where: {
        projectId,
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
      },
      _count: true,
    }),

    // Average duration
    prisma.job.aggregate({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      _avg: {
        durationMs: true,
      },
    }),
  ]);

  return {
    totalCost: totalCost._sum.costUsd ?? 0,
    statusCounts,
    avgDurationMs: avgDuration._avg.durationMs ?? null,
  };
}

/**
 * Fetches workflow distribution for a project
 * Returns count of tickets by workflow type
 *
 * @param projectId - Project ID to aggregate
 * @returns Workflow distribution
 */
export async function fetchWorkflowDistribution(projectId: number) {
  return await prisma.ticket.groupBy({
    by: ['workflowType'],
    where: {
      projectId,
    },
    _count: true,
  });
}

/**
 * Counts tickets shipped in the current month
 *
 * @param projectId - Project ID to filter tickets
 * @param monthStart - Start of current month
 * @returns Count of shipped tickets
 */
export async function countTicketsShippedThisMonth(
  projectId: number,
  monthStart: Date
) {
  return await prisma.ticket.count({
    where: {
      projectId,
      stage: 'SHIP',
      updatedAt: { gte: monthStart },
    },
  });
}
