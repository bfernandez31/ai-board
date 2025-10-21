import { useQuery } from '@tanstack/react-query';
import type { TicketAttachment } from '@/app/lib/types/ticket';

/**
 * Image with index field for frontend reference
 */
export interface TicketImageWithIndex extends TicketAttachment {
  index: number;
}

/**
 * Response from GET /api/projects/:projectId/tickets/:id/images
 */
interface GetImagesResponse {
  images: TicketImageWithIndex[];
}

/**
 * TanStack Query hook for fetching ticket image metadata
 *
 * Implements lazy loading pattern - only fetches when enabled=true (gallery expanded).
 * Caches results to prevent redundant API calls on subsequent views.
 *
 * @param projectId - Project ID
 * @param ticketId - Ticket ID
 * @param enabled - Whether to enable the query (lazy loading control)
 * @returns Query result with images array, loading state, and error state
 *
 * @example
 * const { data, isLoading, error } = useTicketImages(projectId, ticketId, isGalleryExpanded);
 * const images = data?.images ?? [];
 */
export function useTicketImages(projectId: number, ticketId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['ticket', projectId, ticketId, 'images'],
    queryFn: async (): Promise<GetImagesResponse> => {
      const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/images`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch images');
      }

      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes (metadata is relatively stable)
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention (formerly cacheTime)
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
