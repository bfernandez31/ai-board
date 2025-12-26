/**
 * Component Test Rendering Utility
 *
 * Provides a render function that wraps components with all necessary providers
 * for component integration testing. Follows the Testing Trophy methodology.
 *
 * @see specs/AIB-117-testing-trophy-component/contracts/render-with-providers.ts
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { createTestQueryClient } from './test-query-client';

/**
 * Extended render options for component tests
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Optional custom QueryClient instance.
   * If not provided, creates a fresh test-optimized QueryClient.
   */
  queryClient?: QueryClient;

  /**
   * Optional initial URL search params for router-dependent components.
   * Useful for testing components that read from URL state.
   */
  initialSearchParams?: URLSearchParams;
}

/**
 * Extended render result with test utilities
 */
export interface CustomRenderResult extends RenderResult {
  /**
   * The QueryClient used for this render.
   * Useful for cache inspection, manual invalidation, or state assertions.
   */
  queryClient: QueryClient;

  /**
   * Pre-configured userEvent instance.
   * Use this instead of creating your own to ensure proper setup.
   */
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Provider wrapper component for test isolation
 */
export function TestProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}): ReactElement {
  const client = queryClient ?? createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Renders a React component with all necessary providers for testing.
 *
 * @example
 * ```typescript
 * import { renderWithProviders, screen } from '@/tests/helpers/render-with-providers';
 *
 * it('should render component', async () => {
 *   const { user, queryClient } = renderWithProviders(
 *     <MyComponent prop="value" />
 *   );
 *
 *   // Use pre-configured user event
 *   await user.click(screen.getByRole('button'));
 *
 *   // Inspect query client state if needed
 *   expect(queryClient.getQueryState(['myQuery'])).toBeDefined();
 * });
 * ```
 *
 * @param ui - The React element to render
 * @param options - Optional configuration for the render
 * @returns Extended render result with queryClient and user
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): CustomRenderResult {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const user = userEvent.setup();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <TestProviders queryClient={queryClient}>
      {children}
    </TestProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
    user,
  };
}

// Re-exports from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Default export as 'render' for convenience
export { renderWithProviders as render };
