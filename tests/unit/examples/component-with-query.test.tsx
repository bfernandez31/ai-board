/**
 * Example: Component Testing with TanStack Query
 *
 * This example demonstrates:
 * - Testing a component that uses useQuery
 * - Mocking fetch/API calls
 * - Testing loading and error states
 * - Using custom render wrapper
 *
 * Real component being tested would be like:
 * function DocumentPanel({ projectId, ticketId }) {
 *   const { data, isLoading, error } = useDocumentation(
 *     projectId,
 *     ticketId,
 *     'spec',
 *     true
 *   );
 *   return <div>...</div>;
 * }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/fixtures/vitest/render-utils';
import { mockTicket } from '@/tests/fixtures/factories/mock-data';

// This would be your actual component
// import { DocumentPanel } from '@/components/document-panel';

describe('Component with TanStack Query (Example)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global.fetch for each test
    global.fetch = vi.fn();
  });

  it('renders loading state while fetching', async () => {
    // Setup: mock fetch to be slow
    let resolveResponse: any;
    const responsePromise = new Promise(resolve => {
      resolveResponse = resolve;
    });

    global.fetch = vi.fn(() => responsePromise);

    // Act
    // renderWithProviders(<DocumentPanel projectId={1} ticketId={123} />);

    // Assert: should show loading state initially
    // expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

    // Act: resolve the fetch
    resolveResponse({
      ok: true,
      json: async () => ({ content: 'Test documentation' }),
    });

    // Assert: loading should disappear and content should show
    // await waitFor(() => {
    //   expect(screen.queryByRole('status')).not.toBeInTheDocument();
    //   expect(screen.getByText('Test documentation')).toBeInTheDocument();
    // });
  });

  it('renders error state on fetch failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as Response),
    );

    // renderWithProviders(<DocumentPanel projectId={1} ticketId={999} />);

    // await waitFor(() => {
    //   expect(screen.getByRole('alert')).toBeInTheDocument();
    //   expect(screen.getByText(/error/i)).toBeInTheDocument();
    // });
  });

  it('uses correct query parameters', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ content: 'Test' }),
      } as Response),
    );

    // renderWithProviders(<DocumentPanel projectId={1} ticketId={123} />);

    // expect(fetchSpy).toHaveBeenCalledWith('/api/projects/1/tickets/123/spec');
  });

  it('caches results on subsequent renders', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    let fetchCallCount = 0;

    global.fetch = vi.fn(() => {
      fetchCallCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({ content: 'Cached content', callCount: fetchCallCount }),
      } as Response);
    });

    // renderWithProviders(<DocumentPanel projectId={1} ticketId={123} />);

    // Wait for first fetch
    // await waitFor(() => {
    //   expect(screen.getByText('Cached content')).toBeInTheDocument();
    // });

    // Re-render (e.g., parent component re-renders)
    // const { rerender } = renderWithProviders(<DocumentPanel projectId={1} ticketId={123} />);

    // fetch should NOT be called again (using cache)
    // expect(fetchSpy).toHaveBeenCalledTimes(1);
    // expect(screen.getByText('Cached content')).toBeInTheDocument();
  });
});

/**
 * Key patterns used:
 *
 * 1. renderWithProviders instead of render
 *    - Automatically wraps component in QueryClientProvider
 *    - Each test gets fresh QueryClient instance
 *
 * 2. Mock global.fetch in beforeEach
 *    - Clear mocks before each test for isolation
 *    - Returns proper Response-like object
 *
 * 3. Use waitFor for async operations
 *    - Don't use setTimeout or mock timers for query tests
 *    - waitFor checks condition repeatedly with exponential backoff
 *
 * 4. Test loading and error states
 *    - Components should have distinct states for each
 *    - Use role queries (getByRole) - more maintainable
 *
 * 5. Verify caching behavior
 *    - TanStack Query's strength is intelligent caching
 *    - Verify data is reused when appropriate
 */
