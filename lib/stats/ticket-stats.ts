/**
 * Ticket Stats Utilities
 *
 * Pure functions for calculating aggregated statistics from job telemetry data.
 * Used by the Stats tab in the ticket detail modal.
 */

import type {
  TicketJobWithStats,
  TicketStats,
  ToolUsageCount,
} from '@/lib/types/job-types';

/**
 * Aggregate tool usage from jobs.
 * Counts occurrences of each tool and sorts by frequency (descending).
 */
export function aggregateToolUsage(jobs: TicketJobWithStats[]): ToolUsageCount[] {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    for (const tool of job.toolsUsed) {
      counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate aggregated statistics from job telemetry.
 * Only considers COMPLETED jobs for aggregations to ensure accurate metrics.
 */
export function calculateTicketStats(jobs: TicketJobWithStats[]): TicketStats {
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

  const totalCost = completedJobs.reduce(
    (sum, j) => sum + (j.costUsd ?? 0),
    0
  );
  const totalDuration = completedJobs.reduce(
    (sum, j) => sum + (j.durationMs ?? 0),
    0
  );
  const totalInputTokens = completedJobs.reduce(
    (sum, j) => sum + (j.inputTokens ?? 0),
    0
  );
  const totalOutputTokens = completedJobs.reduce(
    (sum, j) => sum + (j.outputTokens ?? 0),
    0
  );
  const cacheReadTokens = completedJobs.reduce(
    (sum, j) => sum + (j.cacheReadTokens ?? 0),
    0
  );

  // Cache efficiency = (cacheReadTokens / totalInputTokens) * 100
  // Return null if there are no input tokens to avoid division by zero
  const cacheEfficiency =
    totalInputTokens > 0
      ? (cacheReadTokens / totalInputTokens) * 100
      : null;

  return {
    totalCost,
    totalDuration,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    cacheReadTokens,
    cacheEfficiency,
    toolUsage: aggregateToolUsage(completedJobs),
  };
}
