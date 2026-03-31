'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HealthTrendsResponse } from '@/lib/health/types';

export function useHealthTrends(projectId: number) {
  return useQuery({
    queryKey: queryKeys.health.trends(projectId),
    queryFn: async (): Promise<HealthTrendsResponse> => {
      const response = await fetch(`/api/projects/${projectId}/health/trends`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
