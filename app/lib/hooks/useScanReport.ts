'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { ScanHistoryItem } from '@/lib/health/types';

interface ScanReportResponse {
  scan: (ScanHistoryItem & { report: string | null }) | null;
}

export function useScanReport(projectId: number, moduleType: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.health.scanReport(projectId, moduleType),
    queryFn: async (): Promise<ScanReportResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/health/scans/latest?type=${moduleType}`,
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
