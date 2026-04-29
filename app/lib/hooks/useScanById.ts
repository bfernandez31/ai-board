'use client';

import { useQuery } from '@tanstack/react-query';
import { parseScanReport } from '@/lib/health/report-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  HealthModuleType,
  ScanReport,
  ScanHistoryItemWithReport,
} from '@/lib/health/types';

interface ScanByIdResult {
  scan: ScanHistoryItemWithReport | null;
  report: ScanReport | null;
}

export function useScanById(
  projectId: number,
  moduleType: HealthModuleType | null,
  scanId: number | null
) {
  return useQuery({
    queryKey: queryKeys.health.scan(projectId, scanId),
    queryFn: async (): Promise<ScanByIdResult> => {
      if (scanId === null || moduleType === null) {
        return { scan: null, report: null };
      }

      const response = await fetch(
        `/api/projects/${projectId}/health/scans/${scanId}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const scan: ScanHistoryItemWithReport | null = data.scan ?? null;
      if (!scan) return { scan: null, report: null };

      const report = parseScanReport(moduleType, scan.report);
      return { scan, report };
    },
    enabled: scanId !== null && moduleType !== null,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}
