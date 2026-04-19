import type { AgentFilter, AgentOption } from '@/lib/analytics/types';

export const DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD = 'last-12-months';
export const DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT: AgentFilter = 'all';

export interface ProjectsActivityHeatmapFilters {
  period: string;
  agent: AgentFilter;
}

export interface ProjectsActivityHeatmapCell {
  date: string;
  jobCount: number;
  shippedTicketCount: number;
  totalCost: number | null;
  hasMissingCosts: boolean;
}

export interface ProjectsActivityHeatmapSummary {
  jobCount: number;
  shippedTicketCount: number;
  label: string;
}

export interface HeatmapPeriodOption {
  value: string;
  label: string;
}

export interface ProjectsActivityHeatmapData {
  filters: ProjectsActivityHeatmapFilters;
  summary: ProjectsActivityHeatmapSummary;
  periodStart: string;
  periodEnd: string;
  userCreatedYear: number;
  availablePeriods: HeatmapPeriodOption[];
  availableAgents: AgentOption[];
  cells: ProjectsActivityHeatmapCell[];
  hasAnyActivity: boolean;
  generatedAt: string;
}
