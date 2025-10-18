/**
 * TanStack Query Hooks for Documentation History and Diff
 *
 * Provides query hooks for fetching commit history and diffs
 * with caching, loading states, and error handling.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { DocumentationHistoryResponse, DocumentationDiffResponse } from '@/app/lib/schemas/documentation';

/**
 * Fetch commit history for a documentation file
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type (spec, plan, or tasks)
 * @returns Promise resolving to DocumentationHistoryResponse
 * @throws Error if fetch fails
 */
async function fetchDocumentationHistory(
  projectId: number,
  ticketId: number,
  docType: 'spec' | 'plan' | 'tasks'
): Promise<DocumentationHistoryResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/docs/history?ticketId=${ticketId}&docType=${docType}`
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch commit history');
  }

  return res.json();
}

/**
 * Hook for fetching commit history for a documentation file
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true (lazy loading).
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type to fetch history for
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with commits array, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useDocumentationHistory(
 *   1,
 *   123,
 *   'spec',
 *   true // fetch when View History button clicked
 * );
 */
export function useDocumentationHistory(
  projectId: number,
  ticketId: number,
  docType: 'spec' | 'plan' | 'tasks',
  enabled: boolean = false
) {
  return useQuery({
    queryKey: queryKeys.projects.documentationHistory(projectId, ticketId, docType),
    queryFn: () => fetchDocumentationHistory(projectId, ticketId, docType),
    enabled, // Lazy: only fetch when View History clicked
    staleTime: 30 * 1000, // 30 seconds (history may change with new commits)
    gcTime: 5 * 60 * 1000, // 5 minutes (keep in cache)
    refetchOnWindowFocus: true, // Refetch on focus to catch new commits
    retry: 2, // Retry twice for resilience against GitHub API errors
  });
}

/**
 * Fetch diff for a specific commit
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type (spec, plan, or tasks)
 * @param sha - Commit SHA to fetch diff for
 * @returns Promise resolving to DocumentationDiffResponse
 * @throws Error if fetch fails
 */
async function fetchDocumentationDiff(
  projectId: number,
  ticketId: number,
  docType: 'spec' | 'plan' | 'tasks',
  sha: string
): Promise<DocumentationDiffResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/docs/diff?ticketId=${ticketId}&docType=${docType}&sha=${sha}`
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch commit diff');
  }

  return res.json();
}

/**
 * Hook for fetching diff for a specific commit
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true and SHA is provided.
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type
 * @param sha - Commit SHA to fetch diff for (null when no commit selected)
 * @returns Query result with files array, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useDocumentationDiff(
 *   1,
 *   123,
 *   'spec',
 *   'abc123...' // SHA from selected commit
 * );
 */
export function useDocumentationDiff(
  projectId: number,
  ticketId: number,
  docType: 'spec' | 'plan' | 'tasks',
  sha: string | null
) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId, 'documentation', docType, 'diff', sha] as const,
    queryFn: () => fetchDocumentationDiff(projectId, ticketId, docType, sha!),
    enabled: !!sha, // Only fetch when SHA is selected
    staleTime: Infinity, // Commits are immutable, cache forever
    gcTime: 30 * 60 * 1000, // 30 minutes (keep diffs in cache longer)
    refetchOnWindowFocus: false, // No need to refetch (commits are immutable)
    retry: 2, // Retry twice for resilience
  });
}
