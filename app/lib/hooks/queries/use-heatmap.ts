import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams();
  if (filters.year !== 'rolling') params.set('year', filters.year);
  if (filters.agent !== 'all') params.set('agent', filters.agent);

  const url = params.toString()
    ? `/api/heatmap?${params.toString()}`
    : '/api/heatmap';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch heatmap data');
  }
  return response.json();
}

export function useHeatmap(filters: HeatmapFilters, initialData?: HeatmapData) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(filters.year, filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
