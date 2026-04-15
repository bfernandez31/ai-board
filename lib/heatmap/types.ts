import type { AgentOption } from '@/lib/analytics/types';

export interface ShippedTicketInfo {
  ticketKey: string;
  title: string;
}

export interface HeatmapDay {
  date: string;
  jobCount: number;
  costUsd: number | null;
  shippedTickets: ShippedTicketInfo[];
}

export interface HeatmapData {
  days: HeatmapDay[];
  totalJobs: number;
  totalShipped: number;
  agents: AgentOption[];
  periodLabel: string;
  userCreatedYear: number;
}

export interface HeatmapFilters {
  year: 'rolling' | string;
  agent: 'all' | string;
}
