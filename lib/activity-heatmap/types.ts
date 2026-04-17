/**
 * Activity Heatmap Types
 *
 * Types for the GitHub-style contribution heatmap shown on /projects.
 */

import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const HEATMAP_AGENT_FILTER_VALUES = ['all', ...ALL_AGENTS] as const;
export type HeatmapAgentFilter = (typeof HEATMAP_AGENT_FILTER_VALUES)[number];

/** Period selector value: either a 4-digit calendar year, or the rolling-12-months sentinel. */
export type HeatmapPeriod = number | 'last-12-months';

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapTicketSummary {
  ticketKey: string;
  title: string;
  projectKey: string;
}

export interface HeatmapDayCell {
  /** ISO date in YYYY-MM-DD form (calendar day bucketed by UTC day boundaries). */
  date: string;
  jobCount: number;
  /** Sum of costUsd for jobs that have a recorded cost. */
  totalCostUsd: number;
  /** True if at least one of the day's jobs had a recorded costUsd. */
  hasCost: boolean;
  shippedTickets: HeatmapTicketSummary[];
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapData {
  /** Inclusive ISO date (YYYY-MM-DD) for the first day in the grid. */
  startDate: string;
  /** Inclusive ISO date (YYYY-MM-DD) for the last day in the grid. */
  endDate: string;
  totalJobs: number;
  totalTicketsShipped: number;
  /** One entry per calendar day in [startDate, endDate], sorted ascending. */
  days: HeatmapDayCell[];
  availableAgents: HeatmapAgentOption[];
  /** Available years from the user's account creation year to current year. */
  availableYears: number[];
  filters: HeatmapFilters;
  generatedAt: string;
}

export type NamedAgent = Agent;
