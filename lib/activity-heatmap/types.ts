/**
 * Activity Heatmap Types
 *
 * Shared types for the GitHub-style contribution heatmap that aggregates
 * AI activity (jobs + shipped tickets) across all of a user's projects.
 */

import type { AgentFilter, AgentOption } from '@/lib/analytics/types';

/**
 * Period selector value:
 *  - 'last-12-months' (default rolling window)
 *  - calendar year as 4-digit string ('2024', '2025', ...)
 */
export type HeatmapPeriod = 'last-12-months' | string;

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: AgentFilter;
}

/**
 * One day in the heatmap. `date` is the ISO date (YYYY-MM-DD) in UTC.
 * `totalCost` is null when no completed job that day had a recorded cost
 * (used to suppress "$NaN" / "$0" from the tooltip).
 */
export interface HeatmapDay {
  date: string;
  jobCount: number;
  totalCost: number | null;
  ticketsShipped: number;
}

export interface HeatmapPeriodInfo {
  /** ISO date (YYYY-MM-DD) of the first day in the period (inclusive) */
  start: string;
  /** ISO date (YYYY-MM-DD) of the last day in the period (inclusive) */
  end: string;
  /** Human-readable label, e.g. "Last 12 months" or "2024" */
  label: string;
  /** Discriminator: 'rolling' or 'year' */
  kind: 'rolling' | 'year';
  /** When kind === 'year', the year as a number; otherwise undefined */
  year?: number;
}

export interface HeatmapData {
  period: HeatmapPeriodInfo;
  totals: {
    jobs: number;
    ticketsShipped: number;
  };
  days: HeatmapDay[];
  availableAgents: AgentOption[];
  /**
   * Calendar years (descending) the user can select in addition to
   * "Last 12 months". Empty when the user signed up this year.
   */
  availableYears: number[];
  filters: HeatmapFilters;
  generatedAt: string;
}
