import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const HEATMAP_PERIOD_ROLLING = 'last-12-months' as const;
export type HeatmapPeriodRolling = typeof HEATMAP_PERIOD_ROLLING;
export type HeatmapPeriod = HeatmapPeriodRolling | `${number}`;

export const HEATMAP_AGENT_FILTER_VALUES = ['all', ...ALL_AGENTS] as const;
export type HeatmapAgentFilter = (typeof HEATMAP_AGENT_FILTER_VALUES)[number];
export type HeatmapNamedAgent = Agent;

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapDay {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  jobCount: number;
  /** Total cost for jobs with recorded cost; null when no job with cost exists */
  totalCost: number | null;
  ticketsShipped: number;
}

export interface HeatmapPeriodOption {
  value: HeatmapPeriod;
  label: string;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
}

export interface HeatmapData {
  days: HeatmapDay[];
  /** Inclusive ISO date of the period's first day */
  periodStart: string;
  /** Inclusive ISO date of the period's last day */
  periodEnd: string;
  totalJobs: number;
  totalShipped: number;
  filters: HeatmapFilters;
  periodOptions: HeatmapPeriodOption[];
  agentOptions: HeatmapAgentOption[];
  generatedAt: string;
}
