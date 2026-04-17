'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  HeatmapFilters,
  HeatmapResponse,
} from '@/lib/activity/heatmap-types';

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapResponse> {
  const params = new URLSearchParams({
    year: filters.year,
    agent: filters.agent,
    tz: filters.timezone,
  });
  const response = await fetch(`/api/activity/heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

export function useActivityHeatmap(
  filters: HeatmapFilters,
  options: { initialData?: HeatmapResponse; shouldUseInitialData: boolean }
) {
  return useQuery<HeatmapResponse>({
    queryKey: queryKeys.activityHeatmap.data(filters.year, filters.agent, filters.timezone),
    queryFn: () => fetchHeatmap(filters),
    ...(options.shouldUseInitialData && options.initialData
      ? { initialData: options.initialData }
      : {}),
    refetchInterval: 15_000,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}
