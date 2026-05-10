'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { InsightsReportSummary } from '@/app/components/admin/insights/past-reports-list';

export interface AdminInsightsListResponse {
  reports: InsightsReportSummary[];
  runningReportId: number | null;
}

async function fetchAdminInsightsList(): Promise<AdminInsightsListResponse> {
  const res = await fetch('/api/admin/insights/reports', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error(`Failed to load insights list (${res.status})`);
  }
  return (await res.json()) as AdminInsightsListResponse;
}

export function useAdminInsightsList(
  initialData?: AdminInsightsListResponse
): UseQueryResult<AdminInsightsListResponse | undefined> {
  return useQuery({
    queryKey: queryKeys.admin.insights.list,
    queryFn: fetchAdminInsightsList,
    initialData,
    refetchInterval: (q) =>
      q.state.data?.runningReportId ? 2_000 : false,
    staleTime: 30_000,
  });
}
