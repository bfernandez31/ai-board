import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const HEATMAP_ROLLING_PERIOD = 'last-12m' as const;
export const HEATMAP_AGENT_FILTER_VALUES = ['all', ...ALL_AGENTS] as const;

export type HeatmapPeriod = typeof HEATMAP_ROLLING_PERIOD | string;
export type HeatmapAgentFilter = (typeof HEATMAP_AGENT_FILTER_VALUES)[number];

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapPeriodOption {
  value: HeatmapPeriod;
  label: string;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapShippedTicket {
  ticketKey: string;
  title: string;
  projectKey: string;
}

export interface HeatmapDay {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  jobCount: number;
  /** Sum of costUsd across jobs for that day */
  totalCost: number;
  /** True when cost data is missing for at least one job */
  costIncomplete: boolean;
  shippedTickets: HeatmapShippedTicket[];
}

export interface HeatmapTotals {
  jobCount: number;
  ticketsShipped: number;
}

export interface HeatmapPeriodRange {
  /** Inclusive start date in YYYY-MM-DD (user's local/UTC day) */
  startDate: string;
  /** Inclusive end date in YYYY-MM-DD */
  endDate: string;
  value: HeatmapPeriod;
  label: string;
}

export interface ActivityHeatmapData {
  period: HeatmapPeriodRange;
  periodOptions: HeatmapPeriodOption[];
  availableAgents: HeatmapAgentOption[];
  days: HeatmapDay[];
  totals: HeatmapTotals;
  filters: HeatmapFilters;
  /** ISO timestamp */
  generatedAt: string;
}

export function isHeatmapAgentFilter(value: string): value is HeatmapAgentFilter {
  return (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(value);
}

export const DEFAULT_HEATMAP_FILTERS: HeatmapFilters = {
  period: HEATMAP_ROLLING_PERIOD,
  agent: 'all',
};

export function isNamedAgent(value: HeatmapAgentFilter): value is Agent {
  return value !== 'all';
}
