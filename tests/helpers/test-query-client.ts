import { QueryClient } from '@tanstack/react-query';

/**
 * Create a test QueryClient with test-optimized configuration
 *
 * Features:
 * - No retries for predictable test behavior
 * - No caching to ensure test isolation
 * - Immediate garbage collection
 * - Silent logging to avoid test noise
 *
 * Usage:
 * ```typescript
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { createTestQueryClient } from '@/tests/helpers/test-query-client';
 *
 * test('should fetch data', () => {
 *   const queryClient = createTestQueryClient();
 *   render(
 *     <QueryClientProvider client={queryClient}>
 *       <MyComponent />
 *     </QueryClientProvider>
 *   );
 *   // Test assertions...
 * });
 * ```
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No retries for predictable test execution
        retry: false,
        // No caching to ensure test isolation
        gcTime: 0,
        // No stale time for immediate refetch in tests
        staleTime: 0,
        // Disable refetch on window focus for controlled tests
        refetchOnWindowFocus: false,
        // Disable refetch on reconnect for controlled tests
        refetchOnReconnect: false,
      },
      mutations: {
        // No retries for predictable mutation behavior
        retry: false,
      },
    },
  });
}
