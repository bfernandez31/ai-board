import type { Agent } from '@prisma/client';

export const DEFAULT_ACTIVITY_HEATMAP_VIEW = 'rolling-12m' as const;
export const DEFAULT_ACTIVITY_HEATMAP_AGENT = 'all' as const;

export const ACTIVITY_HEATMAP_AGENT_VALUES = [
  DEFAULT_ACTIVITY_HEATMAP_AGENT,
  'CLAUDE',
  'CODEX',
  'MISTRAL',
  'GEMINI',
] as const satisfies readonly [ActivityHeatmapAgentScopeValue, ...ActivityHeatmapAgentScopeValue[]];

export type ActivityHeatmapAgentScopeValue = 'all' | Agent;
export type ActivityHeatmapYearViewValue = 'rolling-12m' | `year-${number}`;

export interface HeatmapSummary {
  jobCount: number;
  ticketsShipped: number;
  costUsd: number;
  hasAnyActivity: boolean;
  rangeLabel: string;
}

export interface HeatmapLegendBucket {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  minJobs: number;
  maxJobs: number | null;
}

export interface HeatmapDay {
  date: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  weekIndex: number;
  monthLabel: string | null;
  jobCount: number;
  ticketsShipped: number;
  costUsd: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  isInPrimaryRange: boolean;
  displayDate: string;
}

export interface YearViewOption {
  value: ActivityHeatmapYearViewValue;
  label: string;
  startDate: string;
  endDate: string;
  isDefault: boolean;
}

export interface AgentScopeOption {
  value: ActivityHeatmapAgentScopeValue;
  label: string;
  jobCount: number;
  isDefault: boolean;
}

export interface ProjectsActivityHeatmapResponse {
  view: YearViewOption;
  availableViews: YearViewOption[];
  filters: {
    agent: ActivityHeatmapAgentScopeValue;
  };
  availableAgents: AgentScopeOption[];
  summary: HeatmapSummary;
  legend: HeatmapLegendBucket[];
  days: HeatmapDay[];
  generatedAt: string;
}
