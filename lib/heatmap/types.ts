/**
 * Activity Heatmap Types (AIB-704)
 *
 * Derived types for the projects-page activity heatmap. No new persisted
 * entities — all data aggregates from existing Job and Ticket rows.
 */

import type { AgentFilter, NamedAgent } from '@/lib/analytics/types';

export type HeatmapPeriodKey =
  | { kind: 'rolling'; months: 12 }
  | { kind: 'year'; year: number };

export type HeatmapPeriodParam = '12m' | `${number}`;

export interface HeatmapFilters {
  period: HeatmapPeriodKey;
  agent: AgentFilter;
}

export interface ShippedTicket {
  ticketKey: string;
  title: string;
}

export interface HeatmapDay {
  date: string;
  jobCount: number;
  sumCostUsd: number;
  hasAnyCost: boolean;
  shippedTickets: ShippedTicket[];
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapAgentOption {
  value: NamedAgent;
  label: string;
  jobCount: number;
}

export interface HeatmapIntensityThresholds {
  t1: number;
  t2: number;
  t3: number;
  t4: number;
}

export interface HeatmapPeriodBoundaries {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface HeatmapData {
  filters: HeatmapFilters;
  period: {
    startDate: string;
    endDate: string;
    label: string;
  };
  intensityThresholds: HeatmapIntensityThresholds;
  days: HeatmapDay[];
  totals: {
    jobs: number;
    ticketsShipped: number;
  };
  availableAgents: HeatmapAgentOption[];
  accountCreatedYear: number;
  generatedAt: string;
}

export const DEFAULT_HEATMAP_FILTERS: HeatmapFilters = {
  period: { kind: 'rolling', months: 12 },
  agent: 'all',
};
