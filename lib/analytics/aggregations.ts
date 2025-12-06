/**
 * Analytics Aggregation Utilities
 *
 * Pure functions for aggregating and transforming job data into analytics metrics.
 * These functions are designed to be testable and reusable.
 */

import type { StageKey, ToolUsage } from './types';

/**
 * T005: Command-to-stage mapping
 * Maps job commands to their corresponding workflow stages.
 */
export const COMMAND_TO_STAGE: Record<string, StageKey> = {
  specify: 'SPECIFY',
  'comment-specify': 'SPECIFY',
  plan: 'PLAN',
  'comment-plan': 'PLAN',
  'rollback-reset': 'PLAN',
  implement: 'BUILD',
  'quick-impl': 'BUILD',
  'comment-build': 'BUILD',
  clean: 'BUILD',
  verify: 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-verify': 'VERIFY',
};

/**
 * Get stage from job command
 */
export function getStageFromCommand(command: string): StageKey | null {
  return COMMAND_TO_STAGE[command] ?? null;
}

/**
 * T006: Time range date calculation
 * Calculates the start date for a given time range.
 */
export function getDateRangeStart(
  range: '7d' | '30d' | '90d' | 'all',
  now: Date = new Date()
): Date | null {
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

/**
 * Get the previous period start date for trend calculation
 */
export function getPreviousPeriodStart(
  range: '7d' | '30d' | '90d' | 'all',
  now: Date = new Date()
): Date | null {
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

/**
 * T007: Granularity auto-adjustment
 * Returns 'daily' for ranges < 30 days, 'weekly' for >= 30 days.
 */
export function getGranularity(range: '7d' | '30d' | '90d' | 'all'): 'daily' | 'weekly' {
  return range === '7d' ? 'daily' : 'weekly';
}

/**
 * Format date for grouping based on granularity
 */
export function formatDateForGrouping(date: Date, granularity: 'daily' | 'weekly'): string {
  if (granularity === 'daily') {
    const parts = date.toISOString().split('T');
    return parts[0] ?? ''; // YYYY-MM-DD
  } else {
    // ISO week format: YYYY-Www
    const year = date.getFullYear();
    const week = getISOWeek(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }
}

/**
 * Get ISO week number
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * T008: Aggregate tools from job tool arrays
 * Returns top 10 most frequently used tools.
 */
export function aggregateTools(toolArrays: string[][]): ToolUsage[] {
  const counts = new Map<string, number>();

  for (const tools of toolArrays) {
    for (const tool of tools) {
      counts.set(tool, (counts.get(tool) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * Job interface for hasAnalyticsData check
 */
interface JobForDataCheck {
  status: string;
  costUsd: number | null;
  inputTokens: number | null;
}

/**
 * T009: Check if project has analytics data
 * Returns true if at least one completed job has cost or token data.
 */
export function hasAnalyticsData(jobs: JobForDataCheck[]): boolean {
  return jobs.some(
    (job) => job.status === 'COMPLETED' && (job.costUsd != null || job.inputTokens != null)
  );
}

/**
 * T030: Format number in abbreviated format (e.g., $1.2K, 1.5M)
 */
export function formatAbbreviatedNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(value < 10 ? 2 : 0);
}

/**
 * Format cost in USD
 */
export function formatCost(value: number): string {
  if (value >= 1_000) {
    return `$${formatAbbreviatedNumber(value)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Calculate percentage change between two values
 */
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format number with abbreviations for large values (K, M)
 * Uses locale formatting for smaller values.
 * Used primarily for token counts in Stats tab.
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
