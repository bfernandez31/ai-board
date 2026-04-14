'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapFilters, HeatmapResponse } from '@/lib/activity-heatmap/types';

async function fetchHeatmapData(filters: HeatmapFilters): Promise<HeatmapResponse> {
  const params = new URLSearchParams();
  params.set('year', String(filters.year));
  params.set('agent', filters.agent);

  const res = await fetch(`/api/activity-heatmap?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch heatmap data');
  }
  return res.json();
}

export function useActivityHeatmap(filters: HeatmapFilters) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(String(filters.year), filters.agent),
    queryFn: () => fetchHeatmapData(filters),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
