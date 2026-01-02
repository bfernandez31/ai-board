import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/tests/helpers/test-query-client';

// Re-export RTL utilities
export { screen, within, waitFor } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Re-export createTestQueryClient for direct usage
export { createTestQueryClient } from '@/tests/helpers/test-query-client';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: ReturnType<typeof createTestQueryClient>;
}

interface RenderWithProvidersResult extends RenderResult {
  queryClient: ReturnType<typeof createTestQueryClient>;
}

/**
 * Render a React component with all necessary providers for testing
 *
 * Features:
 * - QueryClientProvider with test-optimized client
 * - Returns queryClient for direct manipulation in tests
 *
 * Usage:
 * ```typescript
 * import { renderWithProviders, screen, userEvent } from '@/tests/utils/component-test-utils';
 *
 * it('should handle form submission', async () => {
 *   const user = userEvent.setup();
 *   renderWithProviders(<MyComponent />);
 *
 *   await user.type(screen.getByLabelText(/email/i), 'test@example.com');
 *   await user.click(screen.getByRole('button', { name: /submit/i }));
 *
 *   expect(screen.getByText(/success/i)).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: RenderWithProvidersOptions = {}
): RenderWithProvidersResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}
