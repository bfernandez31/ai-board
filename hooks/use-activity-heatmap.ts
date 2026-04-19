'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  HeatmapFilters,
  HeatmapPayload,
  HeatmapPeriod,
} from '@/lib/analytics/heatmap-types';

function periodToWire(period: HeatmapPeriod): string {
  return period.kind === 'last-12-months' ? 'last-12-months' : String(period.year);
}

function buildUrl(filters: HeatmapFilters): string {
  const params = new URLSearchParams();
  params.set('period', periodToWire(filters.period));
  params.set('agent', filters.agent);
  params.set('tz', filters.timezone);
  return `/api/activity-heatmap?${params.toString()}`;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapPayload> {
  const response = await fetch(buildUrl(filters));
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

export function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  if (a.agent !== b.agent) return false;
  if (a.timezone !== b.timezone) return false;
  if (a.period.kind !== b.period.kind) return false;
  if (a.period.kind === 'calendar-year' && b.period.kind === 'calendar-year') {
    return a.period.year === b.period.year;
  }
  return true;
}

export interface UseActivityHeatmapInput {
  filters: HeatmapFilters;
  initialData: HeatmapPayload;
}

export function useActivityHeatmap({ filters, initialData }: UseActivityHeatmapInput) {
  const shouldUseInitialData = filtersMatch(filters, initialData.filters);
  return useQuery({
    queryKey: queryKeys.activityHeatmap.data(
      periodToWire(filters.period),
      filters.agent,
      filters.timezone
    ),
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
