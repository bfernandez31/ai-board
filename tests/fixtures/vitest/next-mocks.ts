/**
 * Next.js navigation mocks for Vitest
 *
 * Usage:
 * import { vi } from 'vitest';
 * import { createNextNavigationMocks } from '@/tests/fixtures/vitest/next-mocks';
 *
 * vi.mock('next/navigation', () => createNextNavigationMocks());
 *
 * Or for mutable state:
 * import { createNextNavigationMocksWithState } from '@/tests/fixtures/vitest/next-mocks';
 * vi.mock('next/navigation', () => createNextNavigationMocksWithState());
 */

import { vi } from 'vitest';
import type { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * Simple mock without state management
 * Use for tests that don't need to track router calls
 */
export function createNextNavigationMocks() {
  return {
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
  };
}

/**
 * Mock with internal state management
 * Use for tests that need to verify router behavior
 *
 * @example
 * const mocks = createNextNavigationMocksWithState();
 * vi.mock('next/navigation', () => mocks);
 *
 * // In test:
 * const { useRouter, usePathname } = mocks;
 * const router = useRouter();
 * router.push('/new-page');
 * expect(usePathname()).toBe('/new-page');
 */
export function createNextNavigationMocksWithState() {
  let currentPathname = '/';
  const searchParamsMap = new Map<string, URLSearchParams>();
  let currentSearch = '';

  return {
    useRouter: vi.fn(() => {
      return {
        push: vi.fn((path: string) => {
          // Handle paths with query strings
          const [pathname, search] = path.split('?');
          currentPathname = pathname;
          currentSearch = search ? `?${search}` : '';
          searchParamsMap.set(pathname, new URLSearchParams(search || ''));
        }),
        replace: vi.fn((path: string) => {
          const [pathname, search] = path.split('?');
          currentPathname = pathname;
          currentSearch = search ? `?${search}` : '';
          searchParamsMap.set(pathname, new URLSearchParams(search || ''));
        }),
        refresh: vi.fn(),
        back: vi.fn(() => {
          currentPathname = '/';
        }),
        forward: vi.fn(),
        prefetch: vi.fn(),
      };
    }),

    useSearchParams: vi.fn(() => {
      const params = searchParamsMap.get(currentPathname) || new URLSearchParams();
      return params as ReadonlyURLSearchParams;
    }),

    usePathname: vi.fn(() => currentPathname),

    // Utility methods for tests
    _setPathname: (pathname: string) => {
      currentPathname = pathname;
    },
    _setSearchParams: (search: string) => {
      currentSearch = search ? `?${search}` : '';
      searchParamsMap.set(currentPathname, new URLSearchParams(search || ''));
    },
  };
}

/**
 * Mock useRouter with configurable return value
 *
 * @example
 * const pushMock = vi.fn();
 * vi.mocked(useRouter).mockReturnValue({
 *   push: pushMock,
 *   refresh: vi.fn(),
 *   // ... other methods
 * });
 *
 * // In component
 * router.push('/new-page');
 * expect(pushMock).toHaveBeenCalledWith('/new-page');
 */
export function createRouterMock(
  overrides?: Partial<ReturnType<() => any>>,
) {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Mock useSearchParams with preset values
 *
 * @example
 * const params = createSearchParamsMock({ stage: 'BUILD', search: 'test' });
 * expect(params.get('stage')).toBe('BUILD');
 */
export function createSearchParamsMock(
  initialParams?: Record<string, string>,
): ReadonlyURLSearchParams {
  const params = new URLSearchParams(initialParams);
  return params as ReadonlyURLSearchParams;
}

/**
 * Helper to setup Next.js navigation mocks in a test
 *
 * @example
 * describe('Board', () => {
 *   beforeEach(() => {
 *     setupNextNavigationMocks({
 *       pathname: '/projects/1/board',
 *       searchParams: { stage: 'BUILD' },
 *     });
 *   });
 *
 *   it('renders board', () => {
 *     // mocks are now set up
 *   });
 * });
 */
export function setupNextNavigationMocks(config?: {
  pathname?: string;
  searchParams?: Record<string, string>;
}) {
  const mockRouter = createRouterMock();
  const mockSearchParams = createSearchParamsMock(config?.searchParams);
  const mockPathname = config?.pathname ?? '/';

  vi.mocked(useRouter).mockReturnValue(mockRouter);
  vi.mocked(usePathname).mockReturnValue(mockPathname);
  vi.mocked(useSearchParams).mockReturnValue(mockSearchParams);

  return {
    mockRouter,
    mockSearchParams,
    mockPathname,
  };
}

// Export types
export type { ReadonlyURLSearchParams };
