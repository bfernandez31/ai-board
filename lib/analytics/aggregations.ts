/**
 * Analytics aggregation utilities
 *
 * Pure functions for aggregating telemetry data into chart-ready formats
 */

import type {
  CostByStageDataPoint,
  TopToolDataPoint,
} from './types';
import { COMMAND_TO_STAGE } from './types';

type JobWithCommand = {
  command: string;
  costUsd: number | null;
};

type JobWithTools = {
  toolsUsed: string[];
};

/**
 * Aggregates job costs by workflow stage
 * Maps job commands to stages, sums costs, calculates percentages
 *
 * @param jobs - Jobs with command and costUsd fields
 * @returns Array of stage data points sorted by cost descending
 */
export function aggregateCostByStage(
  jobs: JobWithCommand[]
): CostByStageDataPoint[] {
  const stageTotals = new Map<string, { cost: number; count: number }>();

  // Aggregate by stage
  for (const job of jobs) {
    const stage = COMMAND_TO_STAGE[job.command];
    if (!stage) {
      console.warn(`Unknown command: ${job.command}`);
      continue;
    }

    const cost = job.costUsd ?? 0;
    const existing = stageTotals.get(stage) || { cost: 0, count: 0 };
    stageTotals.set(stage, {
      cost: existing.cost + cost,
      count: existing.count + 1,
    });
  }

  // Calculate total for percentages
  const totalCost = Array.from(stageTotals.values()).reduce(
    (sum, { cost }) => sum + cost,
    0
  );

  // Convert to array and calculate percentages
  const result = Array.from(stageTotals.entries()).map(
    ([stage, { cost, count }]) => ({
      stage,
      costUsd: cost,
      jobCount: count,
      percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    })
  );

  // Sort by cost descending
  return result.sort((a, b) => b.costUsd - a.costUsd);
}

/**
 * Aggregates tool usage frequencies from job toolsUsed arrays
 * Returns top 10 tools by usage count
 *
 * @param jobs - Jobs with toolsUsed field
 * @returns Array of top 10 tool data points sorted by usage descending
 */
export function aggregateToolUsage(
  jobs: JobWithTools[]
): TopToolDataPoint[] {
  const toolCounts = new Map<string, number>();

  // Flatten and count tool usage
  for (const job of jobs) {
    for (const tool of job.toolsUsed) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }
  }

  // Calculate total usage for percentages
  const totalUsage = Array.from(toolCounts.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  // Convert to array and calculate percentages
  const result = Array.from(toolCounts.entries()).map(([toolName, usageCount]) => ({
    toolName,
    usageCount,
    percentage: totalUsage > 0 ? (usageCount / totalUsage) * 100 : 0,
  }));

  // Sort by usage count descending and take top 10
  return result.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
}
