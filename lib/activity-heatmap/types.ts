import type { Agent } from '@prisma/client';

export type NamedAgent = Agent;

export interface HeatmapDayData {
  date: string; // YYYY-MM-DD, UTC
  jobCount: number;
  costUsd: number | null;
  ticketsShipped: number;
}

export interface AgentOption {
  value: NamedAgent | 'all';
  label: string;
  jobCount: number;
}

export interface HeatmapResponse {
  days: HeatmapDayData[];
  totalJobs: number;
  totalTicketsShipped: number;
  availableYears: number[];
  availableAgents: AgentOption[];
  period: { start: string; end: string };
}

export interface HeatmapFilters {
  year: 'rolling' | number;
  agent: NamedAgent | 'all';
}

export interface HeatmapCell {
  date: Date;
  level: 0 | 1 | 2 | 3 | 4;
  data: HeatmapDayData | null;
}
