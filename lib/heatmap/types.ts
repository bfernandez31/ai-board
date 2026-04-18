import type { AgentFilter } from '@/lib/analytics/types';

export interface HeatmapFilters {
  period: string;
  agent: AgentFilter;
}

export interface HeatmapDayData {
  date: string;
  jobCount: number;
  costUsd: number | null;
  shippedTickets: string[];
}

export interface HeatmapAgentOption {
  value: AgentFilter;
  label: string;
}

export interface HeatmapData {
  days: Record<string, HeatmapDayData>;
  totalJobs: number;
  totalShipped: number;
  availableAgents: HeatmapAgentOption[];
  periodStart: string;
  periodEnd: string;
  userCreatedAt: string;
  filters: HeatmapFilters;
}

export const DEFAULT_HEATMAP_PERIOD = 'last-12-months';

export function isValidHeatmapPeriod(value: string): boolean {
  if (value === DEFAULT_HEATMAP_PERIOD) return true;
  return /^\d{4}$/.test(value);
}

export function isValidHeatmapAgent(value: string): value is AgentFilter {
  return value === 'all' || (['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'] as string[]).includes(value);
}
