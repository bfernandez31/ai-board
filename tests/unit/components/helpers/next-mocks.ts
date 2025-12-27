/**
 * Next.js Navigation Mocks for RTL Component Tests
 *
 * Provides mock implementations for Next.js App Router hooks.
 * These mocks are used when components use useRouter, usePathname, etc.
 */

import { vi } from 'vitest';
import type { MockInstance } from 'vitest';

// =============================================================================
// Router Mock
// =============================================================================

export interface MockRouter {
  push: MockInstance<[url: string], Promise<boolean>>;
  replace: MockInstance<[url: string], Promise<boolean>>;
  prefetch: MockInstance<[url: string], Promise<void>>;
  back: MockInstance<[], void>;
  forward: MockInstance<[], void>;
  refresh: MockInstance<[], void>;
}

/**
 * Creates a fresh mock router with all navigation methods as spies.
 * Call before each test to reset spy state.
 */
export function createMockRouter(): MockRouter {
  return {
    push: vi.fn().mockResolvedValue(true),
    replace: vi.fn().mockResolvedValue(true),
    prefetch: vi.fn().mockResolvedValue(undefined),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  };
}

/**
 * Default mock router instance for simple test cases.
 * For tests that need to assert on router calls, use createMockRouter()
 * and reset between tests.
 */
export const mockRouter = createMockRouter();

// =============================================================================
// Search Params Mock
// =============================================================================

/**
 * Creates a mock URLSearchParams from an object.
 */
export function createMockSearchParams(
  params: Record<string, string> = {}
): URLSearchParams {
  return new URLSearchParams(params);
}

/**
 * Default empty search params for simple test cases.
 */
export const mockSearchParams = createMockSearchParams();

// =============================================================================
// Pathname Mock
// =============================================================================

let currentPathname = '/';

/**
 * Sets the current pathname for usePathname mock.
 */
export function setMockPathname(pathname: string): void {
  currentPathname = pathname;
}

/**
 * Gets the current mock pathname.
 */
export function getMockPathname(): string {
  return currentPathname;
}

/**
 * Resets the mock pathname to root.
 */
export function resetMockPathname(): void {
  currentPathname = '/';
}

// =============================================================================
// Mock Setup Helper
// =============================================================================

/**
 * Sets up Next.js navigation mocks for a test file.
 * Call this with vi.mock at the top of your test file.
 *
 * @example
 * ```ts
 * vi.mock('next/navigation', () => getNextNavigationMock());
 * ```
 */
export function getNextNavigationMock() {
  return {
    useRouter: () => mockRouter,
    usePathname: () => getMockPathname(),
    useSearchParams: () => mockSearchParams,
    useParams: () => ({}),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
  };
}
