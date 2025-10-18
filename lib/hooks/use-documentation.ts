/**
 * TanStack Query Hook for Documentation Fetching
 *
 * Provides query hook for fetching documentation files (spec, plan, tasks)
 * with caching, loading states, and error handling.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  DocumentContent,
  DocumentType,
} from '../validations/documentation';

/**
 * Query key factory for documentation queries
 * Hierarchical keys enable efficient cache invalidation
 */
export const documentationKeys = {
  /** All documentation queries */
  all: ['documentation'] as const,

  /** All docs for a specific project */
  project: (projectId: number) => ['documentation', projectId] as const,

  /** All docs for a specific ticket */
  ticket: (projectId: number, ticketId: number) =>
    ['documentation', projectId, ticketId] as const,

  /** Specific document for a ticket */
  document: (projectId: number, ticketId: number, docType: DocumentType) =>
    ['documentation', projectId, ticketId, docType] as const,
};

/**
 * Fetch documentation content from API
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type (spec, plan, or tasks)
 * @returns Promise resolving to DocumentContent
 * @throws Error if fetch fails
 */
async function fetchDocumentation(
  projectId: number,
  ticketId: number,
  docType: DocumentType
): Promise<DocumentContent> {
  const res = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/${docType}`
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch documentation');
  }

  return res.json();
}

/**
 * Hook for fetching documentation content
 *
 * Provides caching, loading states, and error handling via TanStack Query.
 * Only fetches when enabled=true (lazy loading).
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param docType - Document type to fetch
 * @param enabled - Whether to enable the query (default: false for lazy loading)
 * @returns Query result with data, loading, and error states
 *
 * @example
 * const { data, isLoading, error } = useDocumentation(
 *   1,
 *   123,
 *   'plan',
 *   true // fetch when modal opens
 * );
 */
export function useDocumentation(
  projectId: number,
  ticketId: number,
  docType: DocumentType,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: documentationKeys.document(projectId, ticketId, docType),
    queryFn: () => fetchDocumentation(projectId, ticketId, docType),
    enabled, // Lazy: only fetch when modal opens
    staleTime: 5 * 60 * 1000, // 5 minutes (documentation rarely changes within session)
    gcTime: 30 * 60 * 1000, // 30 minutes (keep in cache longer than default)
    refetchOnWindowFocus: false, // Avoid unnecessary GitHub API calls
    retry: 2, // Retry twice for resilience against transient GitHub API errors
  });
}
