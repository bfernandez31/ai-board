'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ModuleTrends } from '@/lib/health/types';

export function useHealthTrends(projectId: number) {
  return useQuery<ModuleTrends>({
    queryKey: queryKeys.health.trends(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/health/trends`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: projectId > 0,
  });
}
