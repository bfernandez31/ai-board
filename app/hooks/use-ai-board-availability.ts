import { useQuery } from '@tanstack/react-query';
import type { AIBoardAvailability } from '@/app/lib/utils/ai-board-availability';

/**
 * React hook for checking AI-BOARD availability
 *
 * Checks if AI-BOARD can be mentioned for the given ticket based on:
 * - Current ticket stage (must be SPECIFY, PLAN, BUILD, or VERIFY)
 * - No running jobs for the ticket
 *
 * @param ticketId Ticket ID to check availability for
 * @param enabled Whether to enable the query (default: true)
 * @returns Query result with availability status and reason
 *
 * @example
 * const { data: availability, isLoading } = useAIBoardAvailability(123);
 * if (!availability?.available) {
 *   console.log('AI-BOARD unavailable:', availability?.reason);
 * }
 */
export function useAIBoardAvailability(
  ticketId: number | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['ai-board-availability', ticketId],
    queryFn: async (): Promise<AIBoardAvailability> => {
      if (!ticketId) {
        return { available: false, reason: 'No ticket ID provided' };
      }

      const response = await fetch(`/api/tickets/${ticketId}/ai-board-availability`);

      if (!response.ok) {
        throw new Error('Failed to check AI-BOARD availability');
      }

      return response.json();
    },
    enabled: enabled && ticketId !== undefined,
    // Refetch every 2 seconds to detect when running jobs complete
    refetchInterval: 2000,
    // Don't show loading spinner on background refetches
    refetchIntervalInBackground: false,
    // Keep data fresh
    staleTime: 1000,
  });
}
