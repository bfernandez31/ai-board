'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { SearchResponse } from '@/app/lib/types/search';

/**
 * Fetch search results for tickets within a project
 *
 * @param projectId - Project ID to search within
 * @param query - Search query string
 * @returns Search response with matching tickets
 */
async function searchTickets(
  projectId: number,
  query: string
): Promise<SearchResponse> {
  const response = await fetch(
    `/api/projects/${projectId}/tickets/search?q=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

/**
 * Hook for searching tickets within a project
 *
 * Features:
 * - Only fires when query is >= 2 characters
 * - 30-second stale time for caching
 * - Use with debounced query input for best UX
 *
 * @param projectId - Project ID to search within
 * @param query - Debounced search query string
 * @returns Query result with search response
 */
export function useTicketSearch(projectId: number, query: string) {
  return useQuery({
    queryKey: queryKeys.projects.ticketSearch(projectId, query),
    queryFn: () => searchTickets(projectId, query),
    enabled: query.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}
