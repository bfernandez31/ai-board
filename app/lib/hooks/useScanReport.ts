'use client';

import { useQuery } from '@tanstack/react-query';
import { parseScanReport } from '@/lib/health/report-schemas';
import { ACTIVE_SCAN_TYPES } from '@/lib/health/types';
import type { HealthModuleType, ScanReport, ScanHistoryItemWithReport } from '@/lib/health/types';

const ACTIVE_SET = new Set<string>(ACTIVE_SCAN_TYPES);

interface ScanReportResult {
  scan: ScanHistoryItemWithReport | null;
  report: ScanReport | null;
}

export function useScanReport(projectId: number, moduleType: HealthModuleType | null) {
  return useQuery({
    queryKey: ['health', projectId, 'scan-report', moduleType],
    queryFn: async (): Promise<ScanReportResult> => {
      if (!moduleType) return { scan: null, report: null };

      const response = await fetch(
        `/api/projects/${projectId}/health/scans?type=${moduleType}&limit=1&includeReport=true`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const scan: ScanHistoryItemWithReport | null = data.scans?.[0] ?? null;

      if (!scan) return { scan: null, report: null };

      const report = parseScanReport(moduleType, scan.report);
      return { scan, report };
    },
    enabled: moduleType !== null && ACTIVE_SET.has(moduleType),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}
