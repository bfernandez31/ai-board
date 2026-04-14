import type { AgentFilter, AgentOption } from '@/lib/analytics/types';

export interface HeatmapFilters {
  year: 'rolling' | number;
  agent: AgentFilter;
}

export interface HeatmapDayCell {
  date: string; // ISO date string 'YYYY-MM-DD'
  jobCount: number;
  costUsd: number | null;
  ticketsShipped: number;
}

export interface HeatmapData {
  cells: HeatmapDayCell[];
  summary: {
    totalJobs: number;
    totalTicketsShipped: number;
  };
  filters: HeatmapFilters;
  availableYears: number[];
  availableAgents: AgentOption[];
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export function getIntensityLevel(jobCount: number, maxCount: number): IntensityLevel {
  if (jobCount === 0) return 0;
  const ratio = jobCount / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.50) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
