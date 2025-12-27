/**
 * Example: Component Testing with Next.js Navigation
 *
 * This example demonstrates:
 * - Mocking Next.js useRouter and useSearchParams
 * - Testing routing behavior
 * - Testing URL parameter handling
 * - Type-safe mock setup for Next.js
 *
 * Real component being tested might look like:
 * 'use client';
 *
 * function Board() {
 *   const router = useRouter();
 *   const searchParams = useSearchParams();
 *   const pathname = usePathname();
 *   const stage = searchParams.get('stage') || 'INBOX';
 *
 *   return (
 *     <button onClick={() => router.push('/projects/1/board?stage=BUILD')}>
 *       Go to BUILD
 *     </button>
 *   );
 * }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/fixtures/vitest/render-utils';

// Mock next/navigation BEFORE importing any components that use it
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

// After mocking, now we can safely import the mocked module
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

describe('Component with Next.js Navigation (Example)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default state
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as any);

    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
    vi.mocked(usePathname).mockReturnValue('/');
  });

  it('navigates to new stage when filter changes', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: vi.fn(),
    } as any);

    // renderWithProviders(<Board projectId={1} />);

    // const buildButton = screen.getByRole('button', { name: /build/i });
    // fireEvent.click(buildButton);

    // expect(mockPush).toHaveBeenCalledWith('/projects/1/board?stage=BUILD');
  });

  it('reads search params for initial state', () => {
    const mockParams = new URLSearchParams('stage=BUILD&search=test');
    vi.mocked(useSearchParams).mockReturnValue(mockParams as any);

    // renderWithProviders(<Board projectId={1} />);

    // Should display BUILD stage tickets, not INBOX (default)
    // expect(screen.getByText('BUILD Stage')).toBeInTheDocument();
    // expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('reflects pathname in breadcrumbs', () => {
    vi.mocked(usePathname).mockReturnValue('/projects/1/board');

    // renderWithProviders(<Board projectId={1} />);

    // expect(screen.getByText('Projects')).toBeInTheDocument();
    // expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('handles router.back() for navigation', () => {
    const mockBack = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      back: mockBack,
      push: vi.fn(),
    } as any);

    // renderWithProviders(<Board projectId={1} />);

    // const backButton = screen.getByRole('button', { name: /back/i });
    // fireEvent.click(backButton);

    // expect(mockBack).toHaveBeenCalled();
  });
});

/**
 * Key patterns for Next.js component testing:
 *
 * 1. Mock BEFORE importing
 *    - vi.mock() must come before component import
 *    - Vitest hoists vi.mock() calls to top
 *    - But explicit ordering helps readability
 *
 * 2. Mock each navigation hook
 *    - useRouter: For push, replace, refresh, back, forward, prefetch
 *    - useSearchParams: For reading URL query parameters
 *    - usePathname: For reading current path
 *
 * 3. Create fresh mocks in beforeEach
 *    - Test isolation: each test gets clean mocks
 *    - Prevents test pollution from previous test's calls
 *
 * 4. Verify navigation calls
 *    - Don't test Next.js internal routing
 *    - Test that YOUR component calls router.push() correctly
 *    - Use vi.mocked(useRouter).mockReturnValue() to setup return
 *    - Verify the called arguments
 *
 * 5. Test search param handling
 *    - useSearchParams().get('param')
 *    - Handle defaults when param missing
 *    - Test param changes trigger updates
 *
 * 6. Test pathname-based logic
 *    - Breadcrumbs, active states
 *    - Set usePathname mock to test different routes
 *
 * IMPORTANT: Avoid mocking App Router Context if possible
 * - Just mock the hooks (useRouter, useSearchParams, usePathname)
 * - Much simpler than full AppRouterContext provider mocks
 * - Sufficient for testing component behavior
 */

/**
 * More advanced: Stateful router mock
 *
 * import { createNextNavigationMocksWithState } from '@/tests/fixtures/vitest/next-mocks';
 *
 * beforeEach(() => {
 *   const mocks = createNextNavigationMocksWithState();
 *   vi.mock('next/navigation', () => mocks);
 * });
 *
 * Then you can:
 * - Track router.push() calls internally
 * - usePathname() reflects the pushed pathname
 * - Useful for testing navigation flows
 */
