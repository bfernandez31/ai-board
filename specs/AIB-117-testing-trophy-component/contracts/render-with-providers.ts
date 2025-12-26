/**
 * Contract: renderWithProviders Test Utility
 *
 * This contract defines the API for the component test rendering utility.
 * It wraps React Testing Library's render with all necessary providers.
 */

import { ReactElement, ReactNode } from 'react';
import { RenderResult, RenderOptions } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';

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
export declare function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): CustomRenderResult;

/**
 * Provider wrapper component used internally by renderWithProviders.
 * Exported for advanced use cases requiring manual provider composition.
 */
export declare function TestProviders(props: {
  children: ReactNode;
  queryClient?: QueryClient;
}): ReactElement;

// Re-exports from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Default export as 'render' for convenience
export { renderWithProviders as render };
