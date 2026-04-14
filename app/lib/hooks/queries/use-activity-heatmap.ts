/**
 * TanStack Query hook for activity heatmap data
 * Feature: AIB-648 - Activity Heatmap on Projects Page
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HeatmapResponse } from '@/app/api/activity/heatmap/route';

interface UseActivityHeatmapOptions {
  year: number | null; // null = rolling 12 months
  agent: string; // 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'
}

export function useActivityHeatmap({ year, agent }: UseActivityHeatmapOptions) {
  return useQuery({
    queryKey: queryKeys.activity.heatmap(year, agent),
    queryFn: async (): Promise<HeatmapResponse> => {
      const url = new URL('/api/activity/heatmap', window.location.origin);
      if (year !== null) {
        url.searchParams.set('year', String(year));
      }
      if (agent !== 'all') {
        url.searchParams.set('agent', agent);
      }

      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch heatmap data');
      }

      return response.json();
    },
    staleTime: 60000, // 1 minute stale time (heatmap data doesn't change rapidly)
    refetchOnWindowFocus: true,
  });
}
