import type { AgentFilter } from '@/lib/analytics/types';

export interface HeatmapDayData {
  /** Number of jobs completed on this day */
  jobCount: number;
  /** Total cost in USD (null if no cost data available) */
  costUsd: number | null;
  /** Ticket keys shipped on this day (ship job completed) */
  ticketsShipped: string[];
}

export interface HeatmapFilters {
  /** "rolling" for last 12 months, or a 4-digit year string */
  year: string;
  /** Agent filter: "all" or a specific agent */
  agent: AgentFilter;
}

export interface HeatmapData {
  /** Map of ISO date strings (YYYY-MM-DD) to day data */
  days: Record<string, HeatmapDayData>;
  /** Summary counters for the header */
  summary: {
    totalJobs: number;
    ticketsShipped: number;
  };
  /** Available agent options (for filter dropdown) */
  availableAgents: { value: AgentFilter; label: string }[];
  /** Calendar years available for selection */
  availableYears: number[];
  /** User's account creation date (ISO string) */
  userCreatedAt: string;
  /** Active filters */
  filters: HeatmapFilters;
}
