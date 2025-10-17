import { QueryClient } from '@tanstack/react-query';

/**
 * Create a new QueryClient with default configuration
 * Used for server-side rendering and testing
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 seconds
        staleTime: 5000,
        // Cache entries remain in memory for 10 minutes after becoming unused
        gcTime: 10 * 60 * 1000,
        // Don't refetch when window regains focus (per user requirement FR-006, FR-007)
        refetchOnWindowFocus: false,
        // Retry failed requests once for resilience
        retry: 1,
        // Refetch on reconnect for data consistency
        refetchOnReconnect: true,
      },
      mutations: {
        // Don't retry mutations to avoid duplicate operations
        retry: 0,
      },
    },
  });
}

/**
 * Browser-side singleton QueryClient
 * Ensures single instance across client-side navigation
 */
let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Get QueryClient instance
 * - Server: Always creates new instance (no shared state between requests)
 * - Browser: Uses singleton for optimal caching
 */
export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create new instance
    return makeQueryClient();
  } else {
    // Browser: use singleton
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}
