import type { AgentOption, AgentFilter } from '@/lib/analytics/types';

export interface HeatmapDay {
  date: string;
  jobCount: number;
  costUsd: number | null;
  shippedTickets: string[];
}

export interface HeatmapData {
  days: HeatmapDay[];
  totalJobs: number;
  totalShipped: number;
  availableAgents: AgentOption[];
  availableYears: number[];
  userCreatedAt: string;
  generatedAt: string;
}

export interface HeatmapFilters {
  year: string;
  agent: AgentFilter;
}

export interface HeatmapCell {
  date: Date;
  jobCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  costUsd: number | null;
  shippedTickets: string[];
}
