'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapData } from '@/lib/heatmap/types';

async function fetchHeatmap(period: string, agent: string): Promise<HeatmapData> {
  const params = new URLSearchParams({ period, agent });
  const response = await fetch(`/api/heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch heatmap data');
  }
  return response.json();
}

interface UseHeatmapOptions {
  period: string;
  agent: string;
  initialData?: HeatmapData;
}

export function useHeatmap({ period, agent, initialData }: UseHeatmapOptions) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(period, agent),
    queryFn: () => fetchHeatmap(period, agent),
    initialData,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
