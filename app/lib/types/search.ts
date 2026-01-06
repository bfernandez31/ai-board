import { Stage } from '@prisma/client';

/**
 * Represents a ticket search result for display in the dropdown.
 * Minimal data needed for rendering the result item.
 */
export interface SearchResult {
  /** Unique ticket identifier */
  id: number;
  /** Formatted ticket key (e.g., "AIB-123") */
  ticketKey: string;
  /** Ticket title for display */
  title: string;
  /** Current stage for visual indicator */
  stage: Stage;
  /** Timestamp when ticket was closed (null if not closed) */
  closedAt: Date | string | null;
}

/**
 * Search API response structure
 */
export interface SearchResponse {
  /** Array of matching tickets */
  results: SearchResult[];
  /** Total count of matches (may exceed displayed results) */
  totalCount: number;
}

/**
 * Search query parameters
 */
export interface SearchParams {
  /** Search query string (minimum 2 characters) */
  query: string;
  /** Maximum results to return (default: 10) */
  limit?: number;
}
