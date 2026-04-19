import type { Agent } from '@prisma/client';

export type HeatmapPeriod =
  | { kind: 'last-12-months' }
  | { kind: 'calendar-year'; year: number };

export type HeatmapAgentFilter = 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: HeatmapAgentFilter;
  timezone: string;
}

export interface HeatmapShippedTicket {
  ticketKey: string;
  title: string;
}

export interface HeatmapDay {
  date: string;
  jobCount: number;
  totalCost: number | null;
  shippedTickets: HeatmapShippedTicket[];
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapTotals {
  jobs: number;
  shippedTickets: number;
}

export interface HeatmapIntensityThresholds {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
}

export interface HeatmapMeta {
  rangeStart: string;
  rangeEnd: string;
  label: string;
}

export interface HeatmapPayload {
  filters: HeatmapFilters;
  meta: HeatmapMeta;
  days: HeatmapDay[];
  totals: HeatmapTotals;
  thresholds: HeatmapIntensityThresholds;
  distinctAgents: Agent[];
  availableYears: number[];
}

export const HEATMAP_AGENT_FILTER_VALUES = [
  'all',
  'CLAUDE',
  'CODEX',
  'MISTRAL',
  'GEMINI',
] as const satisfies readonly HeatmapAgentFilter[];

export const HEATMAP_DEFAULT_FILTERS: HeatmapFilters = {
  period: { kind: 'last-12-months' },
  agent: 'all',
  timezone: 'UTC',
};

export function createEmptyHeatmapPayload(filters: HeatmapFilters): HeatmapPayload {
  return {
    filters,
    meta: {
      rangeStart: '',
      rangeEnd: '',
      label: filters.period.kind === 'calendar-year' ? String(filters.period.year) : 'Last 12 months',
    },
    days: [],
    totals: { jobs: 0, shippedTickets: 0 },
    thresholds: { t1: 1, t2: 2, t3: 3, t4: 4 },
    distinctAgents: [],
    availableYears: [new Date().getFullYear()],
  };
}
