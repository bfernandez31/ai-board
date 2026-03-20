'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  ComparisonDetail,
  ComparisonSummary,
  ComparisonCheckResult,
} from '@/lib/types/comparison';

export const comparisonKeys = {
  all: ['comparisons'] as const,
  project: (projectId: number) => ['comparisons', projectId] as const,
  ticket: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId] as const,
  check: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId, 'check'] as const,
  report: (projectId: number, ticketId: number, filename: string) =>
    ['comparisons', projectId, ticketId, 'report', filename] as const,
};

interface ComparisonListResponse {
  comparisons: ComparisonSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface ComparisonReportResponse {
  comparison: ComparisonDetail;
}

async function fetchComparisonCheck(
  projectId: number,
  ticketId: number
): Promise<ComparisonCheckResult> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/comparisons/check`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to check comparisons');
  }
  return res.json();
}

async function fetchComparisonList(
  projectId: number,
  ticketId: number,
  limit: number = 10
): Promise<ComparisonListResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/comparisons?limit=${limit}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch comparisons');
  }
  return res.json();
}

async function fetchComparisonReport(
  projectId: number,
  ticketId: number,
  filename: string
): Promise<ComparisonReportResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/comparisons/${encodeURIComponent(filename)}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch comparison report');
  }
  return res.json();
}

export function useComparisonCheck(
  projectId: number,
  ticketId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.check(projectId, ticketId),
    queryFn: () => fetchComparisonCheck(projectId, ticketId),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useComparisonList(
  projectId: number,
  ticketId: number,
  limit: number = 10,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.ticket(projectId, ticketId),
    queryFn: () => fetchComparisonList(projectId, ticketId, limit),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useComparisonReport(
  projectId: number,
  ticketId: number,
  filename: string,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.report(projectId, ticketId, filename),
    queryFn: () => fetchComparisonReport(projectId, ticketId, filename),
    enabled: enabled && projectId > 0 && ticketId > 0 && !!filename,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
