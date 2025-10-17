'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { getQueryClient } from '@/app/lib/query-client';

/**
 * QueryProvider - Wrapper component for TanStack Query
 *
 * Features:
 * - Provides QueryClient to all child components
 * - Integrates React Query DevTools (development only)
 * - Uses singleton pattern for optimal client-side caching
 * - Creates fresh instance for each SSR request
 *
 * Usage:
 * Wrap your application tree at the root level (app/layout.tsx)
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance using singleton in browser, new instance in SSR
  // useState ensures instance is stable across re-renders
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only visible in development builds */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
