import type { Agent } from '@prisma/client';

export type HeatmapYearSelection = 'last-12-months' | `${number}`;
export type HeatmapAgentFilter = 'all' | Agent;

export interface HeatmapFilters {
  year: HeatmapYearSelection;
  agent: HeatmapAgentFilter;
  timezone: string;
}

export interface HeatmapDay {
  date: string;
  jobCount: number;
  ticketsShipped: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  totalCostUsd?: number;
}

export interface HeatmapGridRange {
  startDate: string;
  endDate: string;
  gridStart: string;
  gridEnd: string;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  historicalJobCount: number;
}

export interface HeatmapYearOption {
  value: HeatmapYearSelection;
  label: string;
  isDefault: boolean;
}

export interface HeatmapCounters {
  totalJobs: number;
  ticketsShipped: number;
  periodLabel: string;
}

export interface HeatmapResponse {
  filters: HeatmapFilters;
  range: HeatmapGridRange;
  days: HeatmapDay[];
  counters: HeatmapCounters;
  agentOptions: HeatmapAgentOption[];
  yearOptions: HeatmapYearOption[];
  generatedAt: string;
}
