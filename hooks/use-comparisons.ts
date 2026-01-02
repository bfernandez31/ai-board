/**
 * TanStack Query Hooks for Comparisons
 *
 * Provides query hooks for fetching comparison reports with caching,
 * loading states, and error handling.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  ComparisonSummary,
  ComparisonCheckResult,
} from '@/lib/types/comparison';

/**
 * Query key factory for comparison queries
 * Hierarchical keys enable efficient cache invalidation
 */
export const comparisonKeys = {
  /** All comparison queries */
  all: ['comparisons'] as const,

  /** All comparisons for a project */
  project: (projectId: number) => ['comparisons', projectId] as const,

  /** All comparisons for a ticket */
  ticket: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId] as const,

  /** Comparison check for a ticket */
  check: (projectId: number, ticketId: number) =>
    ['comparisons', projectId, ticketId, 'check'] as const,

  /** Specific comparison report */
  report: (projectId: number, ticketId: number, filename: string) =>
    ['comparisons', projectId, ticketId, 'report', filename] as const,
};

/**
 * API Response types
 */
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

/**
 * Fetch comparison check from API
 */
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

/**
 * Fetch comparison list from API
 */
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

/**
 * Fetch specific comparison report from API
 */
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

/**
 * Hook for checking if a ticket has comparisons
 *
 * Used to conditionally show the "Compare" button in the UI.
 * Lightweight check that doesn't fetch full report content.
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with hasComparisons, count, and latestReport
 *
 * @example
 * const { data } = useComparisonCheck(1, 123);
 * if (data?.hasComparisons) {
 *   // Show "Compare" button
 * }
 */
export function useComparisonCheck(
  projectId: number,
  ticketId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: comparisonKeys.check(projectId, ticketId),
    queryFn: () => fetchComparisonCheck(projectId, ticketId),
    enabled: enabled && projectId > 0 && ticketId > 0,
    staleTime: 30_000, // 30 seconds - comparisons are generated manually
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for fetching comparison list for a ticket
 *
 * Returns list of comparison summaries ordered by generation date.
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param limit - Maximum number of comparisons to fetch
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with comparisons array
 *
 * @example
 * const { data, isLoading } = useComparisonList(1, 123, 10, isOpen);
 */
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
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for fetching a specific comparison report
 *
 * Fetches the full markdown content of a comparison report.
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param filename - Report filename
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with report content and metadata
 *
 * @example
 * const { data, isLoading } = useComparisonReport(
 *   1,
 *   123,
 *   '20260102-120000-vs-AIB-456.md',
 *   true
 * );
 */
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
    staleTime: 5 * 60 * 1000, // 5 minutes - reports don't change
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}
