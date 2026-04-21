/**
 * Heatmap Types (AIB-690)
 *
 * Derived-view types for the /projects activity heatmap. All data is aggregated
 * on the server from existing Job/Ticket/Project/User tables — no schema changes.
 */

import type { AgentFilter, AgentOption, NamedAgent } from './types';

export type { AgentFilter, AgentOption, NamedAgent };

export type HeatmapPeriod =
  | { kind: 'rolling12m'; endDate: string }
  | { kind: 'year'; year: number };

export interface HeatmapFilters {
  period: HeatmapPeriod;
  agent: AgentFilter;
}

export interface DailyCell {
  date: string;
  jobCount: number;
  shipJobCount: number;
  shippedTicketCount: number;
  totalCostUsd: number | null;
  bucket: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapSummary {
  totalJobs: number;
  distinctShippedTickets: number;
  periodLabel: string;
}

export interface BucketThresholds {
  p25: number;
  p50: number;
  p75: number;
  maxJobCount: number;
}

export interface HeatmapData {
  period: {
    kind: 'rolling12m' | 'year';
    startDate: string;
    endDate: string;
    year?: number;
  };
  filters: HeatmapFilters;
  cells: DailyCell[];
  summary: HeatmapSummary;
  thresholds: BucketThresholds;
  availableAgents: AgentOption[];
  availableYears: number[];
  generatedAt: string;
}
