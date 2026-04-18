import type { Agent } from '@prisma/client';

export type HeatmapAgentFilter = 'all' | Agent;

export interface HeatmapCell {
  date: string;
  jobCount: number;
  shippedCount: number;
  totalCost: number | null;
}

export interface HeatmapPeriod {
  value: 'rolling' | string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface HeatmapFilters {
  year: 'rolling' | string;
  agent: HeatmapAgentFilter;
}

export interface HeatmapAgentOption {
  value: HeatmapAgentFilter;
  label: string;
  jobCount: number;
  isDefault: boolean;
}

export interface HeatmapData {
  cells: HeatmapCell[];
  summary: {
    totalJobs: number;
    totalShipped: number;
  };
  thresholds: [number, number, number, number];
  availableAgents: HeatmapAgentOption[];
  availableYears: string[];
  accountCreatedYear: number;
  filters: HeatmapFilters;
}

export const HEATMAP_AGENT_FILTER_VALUES = ['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'] as const;
