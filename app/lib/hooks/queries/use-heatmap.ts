import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapData } from '@/lib/heatmap/types';

interface UseHeatmapOptions {
  year: string;
  agent: string;
  enabled?: boolean;
}

async function fetchHeatmap(year: string, agent: string): Promise<HeatmapData> {
  const url = new URL('/api/heatmap', window.location.origin);
  url.searchParams.set('year', year);
  url.searchParams.set('agent', agent);

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch heatmap data');
  }
  return response.json();
}

export function useHeatmap({ year, agent, enabled = true }: UseHeatmapOptions) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(year, agent),
    queryFn: () => fetchHeatmap(year, agent),
    enabled,
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}
