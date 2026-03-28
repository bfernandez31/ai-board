'use client';

import { useQuery } from '@tanstack/react-query';
import type { HealthScoreResponse } from '@/lib/health/types';

export function useHealthPolling(projectId: number, initialData?: HealthScoreResponse) {
  const queryOptions = {
    queryKey: ['projects', projectId, 'health'] as const,
    queryFn: async (): Promise<HealthScoreResponse> => {
      const response = await fetch(`/api/projects/${projectId}/health`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<HealthScoreResponse>;
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query: { state: { data: HealthScoreResponse | undefined } }) => {
      const data = query.state.data;
      if (!data) return 15_000;
      const hasActiveScans = data.modules.some((m: { status: string }) => m.status === 'scanning');
      return hasActiveScans ? 15_000 : false;
    },
    refetchIntervalInBackground: false,
    ...(initialData !== undefined ? { initialData } : {}),
  };

  return useQuery<HealthScoreResponse>(queryOptions);
}
