'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ScanHistoryResponse } from '@/lib/health/types';

export function useScanHistory(projectId: number, moduleType: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.health.scanHistory(projectId, moduleType),
    queryFn: async (): Promise<ScanHistoryResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/health/scans?type=${moduleType}&limit=10`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}
