'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { serializePeriodParam } from '@/lib/heatmap/period';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';

export async function fetchActivityHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams();
  if (filters.period.kind === 'year') {
    params.set('period', serializePeriodParam(filters.period));
  }
  if (filters.agent !== 'all') {
    params.set('agent', filters.agent);
  }
  const qs = params.toString();
  const url = `/api/projects/activity-heatmap${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch heatmap');
  }
  return res.json();
}

function filtersMatch(left: HeatmapFilters, right: HeatmapFilters): boolean {
  if (left.agent !== right.agent) return false;
  if (left.period.kind !== right.period.kind) return false;
  if (left.period.kind === 'year' && right.period.kind === 'year') {
    return left.period.year === right.period.year;
  }
  return true;
}

export function useActivityHeatmap(filters: HeatmapFilters, initialData: HeatmapData) {
  const shouldUseInitialData = filtersMatch(filters, initialData.filters);
  const periodKey = serializePeriodParam(filters.period);
  return useQuery({
    queryKey: queryKeys.projects.activityHeatmap(periodKey, filters.agent),
    queryFn: () => fetchActivityHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
