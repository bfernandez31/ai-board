/**
 * Heatmap Type Definitions
 *
 * Shared types for the activity heatmap feature (AIB-664).
 * No new Prisma models; these are derived read-model types consumed
 * by the query layer, API route, and client component.
 */

import type { Agent } from '@prisma/client';

/**
 * Period selector value. `'last-12-months'` is the rolling default;
 * a 4-digit year string (e.g. `'2025'`) selects that calendar year.
 */
export type HeatmapPeriod = 'last-12-months' | `${number}`;

export type HeatmapAgentFilter = 'all' | Agent;

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapDayCell {
  /** ISO calendar date (YYYY-MM-DD) for this cell */
  date: string;
  /** false for leading/trailing cells outside the selected period window */
  inPeriod: boolean;
  /** count of terminal-status jobs completed on this date */
  jobCount: number;
  /** distinct tickets whose ship job COMPLETED on this date */
  shippedTicketCount: number;
  /** sum of non-null costUsd; null when every qualifying job had costUsd=null */
  totalCost: number | null;
  /** intensity bucket 0-4 derived from quartiles of non-zero daily counts */
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapAgentOption {
  value: Agent;
  label: string;
  jobCount: number;
}

export interface HeatmapPeriodOption {
  value: HeatmapPeriod;
  label: string;
  isDefault: boolean;
}

export interface HeatmapTotals {
  jobCount: number;
  shippedTicketCount: number;
}

export type HeatmapIntensityThresholds = [number, number, number, number];

export interface HeatmapData {
  filters: HeatmapFilters;
  periodOptions: HeatmapPeriodOption[];
  availableAgents: HeatmapAgentOption[];
  days: HeatmapDayCell[];
  totals: HeatmapTotals;
  intensityThresholds: HeatmapIntensityThresholds;
  generatedAt: string;
}
