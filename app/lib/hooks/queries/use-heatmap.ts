import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';

async function fetchHeatmapData(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    year: filters.year,
    agent: filters.agent,
  });

  const response = await fetch(`/api/heatmap?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch heatmap data');
  }

  return response.json();
}

export function useHeatmap(initialData: HeatmapData, filters: HeatmapFilters) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(filters.year, filters.agent),
    queryFn: () => fetchHeatmapData(filters),
    initialData,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
