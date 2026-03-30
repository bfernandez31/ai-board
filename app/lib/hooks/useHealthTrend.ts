'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TrendResponse } from '@/lib/health/types';

export function useHealthTrend(projectId: number) {
  return useQuery<TrendResponse>({
    queryKey: queryKeys.health.trend(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/health/trend`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    staleTime: Infinity,
  });
}
