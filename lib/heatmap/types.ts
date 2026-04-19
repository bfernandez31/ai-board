import type { Agent } from '@prisma/client';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const HEATMAP_AGENT_FILTER_VALUES = ['all', ...ALL_AGENTS] as const;
export type HeatmapAgentFilter = (typeof HEATMAP_AGENT_FILTER_VALUES)[number];

/** Period selector: "Last 12 months" (rolling) or a specific calendar year. */
export type HeatmapPeriod = 'last12' | number;

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  jobCount: number;
  /** Sum of costUsd for jobs on this day. Null when no job on this day had a recorded cost. */
  totalCost: number | null;
  /** Number of tickets whose `ship` job completed on this day. */
  shipped: number;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapData {
  /** Start of the period (inclusive), ISO date YYYY-MM-DD */
  startDate: string;
  /** End of the period (inclusive), ISO date YYYY-MM-DD */
  endDate: string;
  /** Per-day activity, one entry per day the user has a job or shipped ticket. */
  days: HeatmapDay[];
  totals: {
    jobCount: number;
    ticketsShipped: number;
  };
  availableAgents: HeatmapAgentOption[];
  /** Calendar years from user account creation to current year (inclusive), descending. */
  availableYears: number[];
  filters: HeatmapFilters;
  generatedAt: string;
}

export type { Agent };
