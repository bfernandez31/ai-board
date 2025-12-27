/**
 * Render Helpers for RTL Component Tests
 *
 * Provides renderWithProviders function that wraps components
 * with all required providers (QueryClient, etc.).
 */

import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { TestWrapper, createTestQueryClient } from './test-wrapper';

interface RenderWithProvidersOptions {
  /** Pre-configured QueryClient for testing specific cache states */
  queryClient?: QueryClient;
}

interface RenderWithProvidersResult extends RenderResult {
  /** Access to QueryClient for cache inspection/manipulation */
  queryClient: QueryClient;
}

/**
 * Renders a component wrapped with all required providers.
 *
 * @param ui - React element to render
 * @param options - Optional configuration including custom QueryClient
 * @returns RTL render result plus queryClient reference
 *
 * @example
 * ```tsx
 * const { queryClient } = renderWithProviders(<MyComponent />);
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions
): RenderWithProvidersResult {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
  );

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  };
}
