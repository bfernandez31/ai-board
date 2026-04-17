import type { Agent } from '@prisma/client';

export type HeatmapPeriod = 'last-12-months' | `year-${number}`;

export type HeatmapAgentFilter = 'all' | Agent;

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
}

export interface HeatmapDay {
  date: string;
  jobCount: number;
  totalCost: number;
  hasCost: boolean;
  ticketsShipped: number;
}

export interface HeatmapData {
  days: HeatmapDay[];
  startDate: string;
  endDate: string;
  totalJobs: number;
  totalShipped: number;
  availableAgents: HeatmapAgentOption[];
  availablePeriods: HeatmapPeriod[];
  filters: HeatmapFilters;
  generatedAt: string;
}
