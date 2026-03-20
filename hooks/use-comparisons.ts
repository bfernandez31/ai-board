'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ComparisonSummary,
  ComparisonCheckResult,
} from '@/lib/types/comparison';
import type {
  ComparisonCheckResponse,
  ComparisonListResponse as DbComparisonListResponse,
  EnrichedComparison,
} from '@/components/comparison/types';

export const comparisonKeys = {
  all: ['comparisons'] as const,
  project: (projectId: number) => ['comparisons', projectId] as const,
  ticket: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId] as const,
  check: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId, 'check'] as const,
  report: (projectId: number, ticketId: number, filename: string) =>
    ['comparisons', projectId, ticketId, 'report', filename] as const,
  dbCheck: (projectId: number, ticketId: number) =>
    ['comparisons', 'db', projectId, ticketId, 'check'] as const,
  dbList: (projectId: number, ticketId: number) =>
    ['comparisons', 'db', projectId, ticketId] as const,
  dbDetail: (projectId: number, comparisonId: number) =>
    ['comparisons', 'db', projectId, 'detail', comparisonId] as const,
  dbProject: (projectId: number) =>
    ['comparisons', 'db', projectId] as const,
};

interface ComparisonListResponse {
  comparisons: ComparisonSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface ComparisonReportResponse {
  filename: string;
  content: string;
  metadata: {
    generatedAt: string;
    sourceTicket: string;
    comparedTickets: string[];
    alignmentScore: number;
    branch: string;
  };
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

// --- DB-backed hooks ---

async function fetchDbComparisonCheck(
  projectId: number,
  ticketId: number
): Promise<ComparisonCheckResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/comparisons/db/check`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to check DB comparisons');
  }
  return res.json();
}

async function fetchDbComparisonList(
  projectId: number,
  ticketId: number,
  limit: number = 20
): Promise<DbComparisonListResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/comparisons/db?limit=${limit}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch DB comparisons');
  }
  return res.json();
}

async function fetchComparisonDetail(
  projectId: number,
  comparisonId: number
): Promise<EnrichedComparison> {
  const res = await fetch(
    `/api/projects/${projectId}/comparisons/${comparisonId}`
  );
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch comparison detail');
  }
  return res.json();
}

export function useDbComparisonCheck(
  projectId: number,
  ticketId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.dbCheck(projectId, ticketId),
    queryFn: () => fetchDbComparisonCheck(projectId, ticketId),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDbComparisonList(
  projectId: number,
  ticketId: number,
  limit: number = 20,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.dbList(projectId, ticketId),
    queryFn: () => fetchDbComparisonList(projectId, ticketId, limit),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useComparisonDetail(
  projectId: number,
  comparisonId: number,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: comparisonKeys.dbDetail(projectId, comparisonId),
    queryFn: () => fetchComparisonDetail(projectId, comparisonId),
    enabled: enabled && projectId > 0 && comparisonId > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveComparison(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch(`/api/projects/${projectId}/comparisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save comparison');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comparisonKeys.dbProject(projectId) });
    },
  });
}
