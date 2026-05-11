'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReportListEntry } from '@/app/lib/insights/repository';

const QUERY_KEY = ['admin', 'insights', 'reports'] as const;

export function useInsightsReports(initialData?: ReportListEntry[]) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ReportListEntry[]> => {
      const response = await fetch('/api/admin/insights/reports', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch reports: HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { reports: ReportListEntry[] };
      return payload.reports;
    },
    initialData,
    // Poll every 15s while any RUNNING row is visible; otherwise stay quiet
    // and rely on manual refetch via mutation `invalidateQueries`.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) return false;
      return data.some((r) => r.status === 'RUNNING') ? 15_000 : false;
    },
    staleTime: 0,
  });
}

export const insightsReportsQueryKey = QUERY_KEY;
