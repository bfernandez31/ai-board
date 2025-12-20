import type { TicketWithVersion } from '@/lib/types';
import type { Stage } from '@/lib/stage-transitions';

/**
 * Represents a single search result with ranking information.
 */
export interface TicketSearchResult {
  /** Ticket ID for selection */
  id: number;
  /** Ticket key for display (e.g., "AIB-123") */
  ticketKey: string;
  /** Ticket title */
  title: string;
  /** Current stage for visual indicator */
  stage: Stage;
  /** Match relevance score (higher = better match) */
  relevanceScore: number;
}

/**
 * Component state for the search feature.
 */
export interface TicketSearchState {
  /** Current search query */
  query: string;
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Currently highlighted result index */
  selectedIndex: number;
  /** Filtered and sorted results */
  results: TicketSearchResult[];
}

/**
 * Props for the TicketSearch component.
 */
export interface TicketSearchProps {
  /** All tickets in the current project (from TanStack Query cache) */
  tickets: TicketWithVersion[];
  /** Callback when user selects a ticket */
  onSelectTicket: (ticketId: number) => void;
  /** Optional className for styling */
  className?: string;
  /** Optional placeholder text */
  placeholder?: string;
}

/**
 * Props for the TicketSearchResult component.
 */
export interface TicketSearchResultProps {
  /** The ticket to display */
  ticket: TicketSearchResult;
  /** Whether this result is currently selected */
  isSelected: boolean;
  /** Click handler */
  onClick: () => void;
}

/**
 * Calculates relevance score for a ticket based on the search query.
 *
 * Scoring:
 * - Exact key match: 4 points
 * - Key contains query: 3 points
 * - Title starts with query: 2 points
 * - Title contains query: 1 point
 * - Description contains query: 0.5 points (tiebreaker)
 *
 * @param ticket - Ticket to score
 * @param query - Search query (already lowercased)
 * @returns Relevance score
 */
export function calculateRelevance(
  ticket: TicketWithVersion,
  query: string
): number {
  const key = ticket.ticketKey.toLowerCase();
  const title = ticket.title.toLowerCase();
  const desc = (ticket.description || '').toLowerCase();

  if (key === query) return 4;
  if (key.includes(query)) return 3;
  if (title.startsWith(query)) return 2;
  if (title.includes(query)) return 1;
  if (desc.includes(query)) return 0.5;

  return 0;
}

/**
 * Filters and ranks tickets based on search query.
 *
 * @param tickets - All tickets to search
 * @param query - Search query string
 * @param maxResults - Maximum results to return (default: 10)
 * @returns Filtered, ranked, and limited results
 */
export function searchTickets(
  tickets: TicketWithVersion[],
  query: string,
  maxResults = 10
): TicketSearchResult[] {
  if (!query.trim()) return [];
  if (!Array.isArray(tickets)) return [];

  const q = query.toLowerCase();

  return tickets
    .map((ticket) => ({
      id: ticket.id,
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      stage: ticket.stage,
      relevanceScore: calculateRelevance(ticket, q),
    }))
    .filter((result) => result.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}
