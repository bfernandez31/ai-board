/**
 * TanStack Query hook for the in-app PR diff viewer (AIB-879).
 *
 * Lazily fetches `GET /api/projects/:projectId/tickets/:id/pr-diff` when the
 * viewer opens (`enabled`), with a fresh fetch each open — the diff + comments are
 * live GitHub state. Follows the `useDocumentationDiff` pattern.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { PrDiffResponse } from '@/app/lib/schemas/pr-diff';

/** Error carrying the typed `code` from the API error envelope. */
export class PrDiffError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PrDiffError';
    this.code = code;
  }
}

async function fetchPrDiff(projectId: number, ticketId: number): Promise<PrDiffResponse> {
  const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/pr-diff`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PrDiffError(body.error || 'Failed to fetch PR diff', body.code || 'UNKNOWN');
  }
  return res.json();
}

/**
 * Fetch the ticket's PR diff (Overview + layers + files + comments).
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param options.enabled - Whether to fetch (default false — lazy, on viewer open)
 */
export function usePrDiff(
  projectId: number,
  ticketId: number,
  options: { enabled?: boolean } = {}
) {
  const { enabled = false } = options;
  return useQuery({
    queryKey: queryKeys.projects.prDiff(projectId, ticketId),
    queryFn: () => fetchPrDiff(projectId, ticketId),
    enabled,
    staleTime: 0, // live GitHub state — always refetch on open
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Don't retry deterministic client errors (AUTH_REQUIRED, FORBIDDEN, etc.) —
    // but transient server failures (GITHUB_API_ERROR) and unknown errors get one
    // retry so a single hiccup doesn't make the viewer feel flaky.
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      if (error instanceof PrDiffError) return error.code === 'GITHUB_API_ERROR';
      return true;
    },
  });
}
