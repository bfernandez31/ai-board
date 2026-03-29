'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { HealthResponse } from '@/lib/health/types';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED']);

export function useHealthPolling(projectId: number, pollingInterval: number = 2000) {
  return useQuery({
    queryKey: queryKeys.health.score(projectId),
    queryFn: async (): Promise<HealthResponse> => {
      const response = await fetch(`/api/projects/${projectId}/health`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return pollingInterval;

      const hasActiveScans = data.activeScans.some(
        s => !TERMINAL_STATUSES.has(s.status)
      );

      return hasActiveScans ? pollingInterval : false;
    },
    refetchIntervalInBackground: true,
  });
}
