'use client';

import { useMemo } from 'react';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

/**
 * TicketStats Interface
 *
 * Aggregated statistics computed from jobs for the Stats tab.
 */
export interface TicketStats {
  // Summary cards
  totalCost: number;
  totalDuration: number;
  totalTokens: number;
  cacheEfficiency: number;

  // Detailed breakdowns
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;

  // Jobs list (sorted chronologically)
  jobs: TicketJobWithTelemetry[];

  // Tool usage (sorted by frequency)
  toolsUsage: Array<{ tool: string; count: number }>;

  // Flags
  hasData: boolean;
}

/**
 * Aggregates tool usage from jobs
 * Returns tools sorted by frequency (most used first)
 */
export function aggregateToolsUsage(
  jobs: TicketJobWithTelemetry[]
): Array<{ tool: string; count: number }> {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    if (job.toolsUsed && Array.isArray(job.toolsUsed)) {
      for (const tool of job.toolsUsed) {
        counts.set(tool, (counts.get(tool) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculates cache efficiency percentage
 * Formula: cacheReadTokens / (inputTokens + cacheReadTokens) * 100
 * Returns 0 if denominator is 0
 */
export function calculateCacheEfficiency(
  inputTokens: number,
  cacheReadTokens: number
): number {
  const denominator = inputTokens + cacheReadTokens;
  if (denominator === 0) return 0;
  return (cacheReadTokens / denominator) * 100;
}

/**
 * Aggregates job statistics
 * Pure function for testability
 */
export function aggregateJobStats(
  jobs: TicketJobWithTelemetry[]
): Omit<TicketStats, 'jobs'> {
  // Aggregate totals (treating null as 0)
  const totalCost = jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
  const totalDuration = jobs.reduce((sum, job) => sum + (job.durationMs ?? 0), 0);
  const inputTokens = jobs.reduce((sum, job) => sum + (job.inputTokens ?? 0), 0);
  const outputTokens = jobs.reduce((sum, job) => sum + (job.outputTokens ?? 0), 0);
  const cacheReadTokens = jobs.reduce(
    (sum, job) => sum + (job.cacheReadTokens ?? 0),
    0
  );
  const cacheCreationTokens = jobs.reduce(
    (sum, job) => sum + (job.cacheCreationTokens ?? 0),
    0
  );

  const totalTokens = inputTokens + outputTokens;
  const cacheEfficiency = calculateCacheEfficiency(inputTokens, cacheReadTokens);
  const toolsUsage = aggregateToolsUsage(jobs);

  // Check if any job has meaningful telemetry data
  const hasData = jobs.some(
    (job) => job.costUsd != null || job.inputTokens != null || job.durationMs != null
  );

  return {
    totalCost,
    totalDuration,
    totalTokens,
    cacheEfficiency,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    toolsUsage,
    hasData,
  };
}

/**
 * useTicketStats Hook
 *
 * Computes aggregated statistics from job telemetry data.
 * Memoizes computation to avoid recalculating on every render.
 *
 * @param jobs - Array of jobs with telemetry data
 * @returns Computed TicketStats object
 */
export function useTicketStats(jobs: TicketJobWithTelemetry[]): TicketStats {
  return useMemo(() => {
    // Sort jobs chronologically (oldest first) for timeline display
    const sortedJobs = [...jobs].sort((a, b) => {
      const dateA = new Date(a.startedAt).getTime();
      const dateB = new Date(b.startedAt).getTime();
      return dateA - dateB;
    });

    const aggregated = aggregateJobStats(sortedJobs);

    return {
      ...aggregated,
      jobs: sortedJobs,
    };
  }, [jobs]);
}
