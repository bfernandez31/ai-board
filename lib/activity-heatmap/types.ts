import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const LAST_12_MONTHS: 'last-12-months' = 'last-12-months';
export type HeatmapPeriod = 'last-12-months' | string;

export const HEATMAP_AGENT_FILTER_VALUES = ['all', ...ALL_AGENTS] as const;
export type HeatmapAgentFilter = (typeof HEATMAP_AGENT_FILTER_VALUES)[number];

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Total completed jobs on this day */
  jobCount: number;
  /** Sum of costUsd for jobs with recorded cost; null when every job on this day has no cost data */
  totalCost: number | null;
  /** Distinct tickets whose `ship` workflow job completed on this day */
  ticketsShipped: number;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapPeriodOption {
  value: HeatmapPeriod;
  label: string;
}

export interface HeatmapData {
  filters: HeatmapFilters;
  /** Inclusive period boundary, YYYY-MM-DD */
  periodStart: string;
  /** Inclusive period boundary, YYYY-MM-DD */
  periodEnd: string;
  /** Non-zero days in chronological order (zero-activity days omitted for payload size) */
  days: HeatmapDay[];
  totalJobs: number;
  totalTicketsShipped: number;
  availableAgents: HeatmapAgentOption[];
  availablePeriods: HeatmapPeriodOption[];
  /** ISO timestamp the data was generated */
  generatedAt: string;
}

export type HeatmapAgent = Agent;
