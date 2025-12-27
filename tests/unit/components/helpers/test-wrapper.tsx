/**
 * Test Wrapper Component
 *
 * Provides QueryClientProvider context for component tests.
 * Each test gets an isolated QueryClient to prevent cache pollution.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Creates a QueryClient configured for testing:
 * - No retries (fail fast)
 * - No garbage collection (prevent timing issues)
 * - No stale time (always fresh for tests)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface TestWrapperProps {
  /** React children to wrap with providers */
  children: ReactNode;
  /** Optional pre-configured QueryClient for testing specific cache states */
  queryClient?: QueryClient;
}

/**
 * Wraps children with required providers for component testing.
 * Creates a new QueryClient per test unless one is provided.
 */
export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
