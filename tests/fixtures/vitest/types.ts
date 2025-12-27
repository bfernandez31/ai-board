/**
 * TypeScript type definitions and utilities for component testing
 *
 * Provides:
 * - Type-safe mock creation functions
 * - Test fixture types
 * - React Testing Library type enhancements
 */

import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Options for custom render function
 * Extends React Testing Library RenderOptions
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Optional QueryClient to use for testing
   * If provided, wrapper will use this client instead of creating new one
   */
  queryClient?: QueryClient;
}

/**
 * Return type of renderWithProviders
 * All RTL render results plus exports from testing library
 */
export interface RenderResult extends ReturnType<typeof import('@testing-library/react').render> {}

/**
 * Mock component props for testing
 * Extends standard component props with testing-specific properties
 */
export interface MockComponentProps<T = any> extends T {
  /** Test ID for easier query selection */
  testId?: string;

  /** Mock function for onClick events */
  onClick?: jest.Mock | jest.MockedFunction<() => void>;

  /** Mock function for onSubmit events */
  onSubmit?: jest.Mock | jest.MockedFunction<(data: any) => void>;
}

/**
 * Vitest mocking utilities re-exported with proper typing
 *
 * Usage:
 * import { vi } from 'vitest';
 * const mockFn = vi.fn();
 */
export type { Mock, Mocked, MockedFunction } from 'vitest';

/**
 * Type-safe factory function signature
 *
 * Generic factory that creates objects of type T with partial overrides
 *
 * @example
 * const createMockTicket: Factory<TicketWithVersion> = (overrides) => ({
 *   ...defaults,
 *   ...overrides,
 * });
 */
export type Factory<T> = (overrides?: Partial<T>) => T;

/**
 * Type-safe batch factory function signature
 *
 * Creates multiple objects efficiently
 *
 * @example
 * const createMockTickets: BatchFactory<TicketWithVersion> = (count, overrides) => {
 *   return Array.from({ length: count }, () => createMockTicket(overrides));
 * };
 */
export type BatchFactory<T> = (count: number, overrides?: Partial<T>) => T[];

/**
 * Test context with commonly needed utilities
 */
export interface TestContext {
  /** Query client for current test */
  queryClient: QueryClient;

  /** Mock fetch function */
  fetchMock: jest.Mock;

  /** Mock router functions */
  routerMock: {
    push: jest.Mock;
    replace: jest.Mock;
    refresh: jest.Mock;
    back: jest.Mock;
    forward: jest.Mock;
    prefetch: jest.Mock;
  };

  /** Mock search params */
  searchParamsMock: URLSearchParams;

  /** Mock pathname */
  pathnameMock: string;

  /**
   * Reset all mocks to initial state
   */
  resetMocks: () => void;
}

/**
 * User event interaction helper
 * Wraps @testing-library/user-event for type safety
 */
export interface UserEvent {
  /**
   * Type text into an input
   */
  type: (element: HTMLElement, text: string, options?: any) => Promise<void>;

  /**
   * Click an element
   */
  click: (element: HTMLElement, options?: any) => Promise<void>;

  /**
   * Hover over an element
   */
  hover: (element: HTMLElement) => Promise<void>;

  /**
   * Unhover from an element
   */
  unhover: (element: HTMLElement) => Promise<void>;

  /**
   * Tab through elements
   */
  tab: (options?: any) => Promise<void>;

  /**
   * Upload files
   */
  upload: (element: HTMLElement, files: File | File[]) => Promise<void>;

  /**
   * Clear an input field
   */
  clear: (element: HTMLElement) => Promise<void>;

  /**
   * Select an option from a select element
   */
  selectOptions: (
    element: HTMLElement,
    options: HTMLElement | HTMLElement[] | string | string[]
  ) => Promise<void>;

  /**
   * Deselect an option from a multi-select element
   */
  deselectOptions: (
    element: HTMLElement,
    options: HTMLElement | HTMLElement[] | string | string[]
  ) => Promise<void>;

  /**
   * Trigger pointer events
   */
  pointer: (input: any[] | string) => Promise<void>;
}

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  /** DOM environment: 'happy-dom' | 'jsdom' | 'node' */
  environment: 'happy-dom' | 'jsdom' | 'node';

  /** Timeout for tests in milliseconds */
  testTimeout: number;

  /** Timeout for hooks in milliseconds */
  hookTimeout: number;

  /** Enable fake timers (vi.useFakeTimers) */
  useFakeTimers: boolean;

  /** Clear mocks between tests */
  clearMocks: boolean;
}

/**
 * Async test helper utilities
 */
export interface AsyncTestHelpers {
  /**
   * Wait for condition to be true
   */
  waitFor: <T>(
    callback: () => T,
    options?: { timeout?: number; interval?: number }
  ) => Promise<T>;

  /**
   * Wait for element to be in document
   */
  waitForElement: (
    callback: () => HTMLElement,
    options?: { timeout?: number }
  ) => Promise<HTMLElement>;

  /**
   * Wait for element to be removed
   */
  waitForElementToBeRemoved: (
    element: HTMLElement,
    options?: { timeout?: number }
  ) => Promise<void>;

  /**
   * Advance timers by specific milliseconds
   */
  advanceTimersByTime: (ms: number) => void;

  /**
   * Run all pending timers
   */
  runAllTimers: () => void;

  /**
   * Clear all pending timers
   */
  clearAllTimers: () => void;
}

/**
 * Query result types for easier testing
 */
export interface QueryResultState<T, E = Error> {
  data: T | undefined;
  error: E | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isPending: boolean;
  isFetched: boolean;
  isFetching: boolean;
}

/**
 * Mutation result types for easier testing
 */
export interface MutationResultState<T = any, E = Error, V = any> {
  data: T | undefined;
  error: E | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isPending: boolean;
  mutate: (variables: V) => void;
  mutateAsync: (variables: V) => Promise<T>;
}

/**
 * Common test data patterns
 */
export namespace TestData {
  /**
   * Valid test email addresses
   */
  export const VALID_EMAILS = {
    user: 'user@example.com',
    admin: 'admin@example.com',
    test: 'test@e2e.local',
    invalid: 'not-an-email',
  };

  /**
   * Valid test IDs (for testing ID generation)
   */
  export const VALID_IDS = {
    project: 1,
    ticket: 123,
    user: 'user-1',
    job: 456,
  };

  /**
   * Common test strings
   */
  export const STRINGS = {
    empty: '',
    short: 'a',
    long: 'x'.repeat(1000),
    withSpecialChars: 'Test <script>alert("xss")</script>',
    withUnicode: 'Test 你好 🎉',
  };

  /**
   * Common test values for stages
   */
  export const STAGES = {
    INBOX: 'INBOX',
    SPECIFY: 'SPECIFY',
    PLAN: 'PLAN',
    BUILD: 'BUILD',
    VERIFY: 'VERIFY',
    SHIP: 'SHIP',
  } as const;

  /**
   * Common test values for job status
   */
  export const JOB_STATUSES = {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  } as const;

  /**
   * Common test values for commands
   */
  export const COMMANDS = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    IMPLEMENT: 'implement',
    VERIFY: 'verify',
    QUICK_IMPL: 'quick-impl',
    CLEAN: 'clean',
  } as const;
}

/**
 * Assertion helpers for cleaner tests
 */
export namespace Assertions {
  /**
   * Assert element is visible to user
   */
  export function isVisible(element: HTMLElement): boolean {
    return element && element.offsetHeight > 0;
  }

  /**
   * Assert element is disabled
   */
  export function isDisabled(element: HTMLElement): boolean {
    return element.hasAttribute('disabled') ||
           (element as HTMLButtonElement).disabled;
  }

  /**
   * Assert element is enabled
   */
  export function isEnabled(element: HTMLElement): boolean {
    return !isDisabled(element);
  }

  /**
   * Assert element has class
   */
  export function hasClass(element: HTMLElement, className: string): boolean {
    return element.classList.contains(className);
  }

  /**
   * Assert element has attribute
   */
  export function hasAttribute(element: HTMLElement, attr: string): boolean {
    return element.hasAttribute(attr);
  }

  /**
   * Assert element has attribute with value
   */
  export function hasAttributeValue(
    element: HTMLElement,
    attr: string,
    value: string
  ): boolean {
    return element.getAttribute(attr) === value;
  }
}

/**
 * Re-export commonly used types from dependencies
 */
export type { ReactElement };
export type { PartialDeep } from 'type-fest';
