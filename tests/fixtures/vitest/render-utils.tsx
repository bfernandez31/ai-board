/**
 * Custom React Testing Library render utilities
 * Automatically wraps components with all necessary providers
 *
 * Usage:
 * import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
 *
 * renderWithProviders(<MyComponent />);
 * expect(screen.getByText('expected text')).toBeInTheDocument();
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Create a fresh QueryClient with test-optimized defaults
 * Called once per test via TestWrapper
 *
 * Features:
 * - Disables automatic retries (faster test execution)
 * - Disables garbage collection (predictable cache behavior)
 * - Disables refetch on window focus (test isolation)
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries: tests should not be flaky
        gcTime: 0, // Disable garbage collection: predictable cache state
        refetchOnWindowFocus: false, // Disable refetch on focus: tests are isolated
      },
      mutations: {
        retry: false, // No retries for mutations: avoid duplicate side effects
      },
    },
  });
}

/**
 * Test wrapper component that provides all necessary context providers
 *
 * Included providers:
 * - QueryClientProvider: TanStack Query for data fetching
 * - Additional providers can be added here (routing, auth, theme, etc.)
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  // Create fresh QueryClient for each test
  const [queryClient] = React.useState(() => createTestQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render function that automatically applies TestWrapper
 *
 * @param ui - React component to render
 * @param options - React Testing Library render options
 * @returns Render result with all queries available
 *
 * @example
 * const { getByText, rerender } = renderWithProviders(
 *   <MyComponent prop="value" />
 * );
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

// Re-export everything from React Testing Library for convenience
// This allows: import { renderWithProviders, screen, fireEvent } from render-utils
export { renderWithProviders, createTestQueryClient, TestWrapper };
export * from '@testing-library/react';
