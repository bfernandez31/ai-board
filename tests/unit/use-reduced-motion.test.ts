/**
 * Unit tests for useReducedMotion hook
 * Testing accessibility media query detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

describe('useReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    matchMediaMock = vi.fn();

    // Mock window.matchMedia
    window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is set', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('registers event listener on mount', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    renderHook(() => useReducedMotion());

    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes event listener on unmount', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    });

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates when media query changes from false to true', () => {
    let changeCallback: (() => void) | null = null;
    const mediaQueryState = { matches: false };

    matchMediaMock.mockImplementation(() => ({
      get matches() { return mediaQueryState.matches; },
      addEventListener: (event: string, listener: () => void) => {
        changeCallback = listener;
        addEventListenerMock(event, listener);
      },
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate media query change — update the snapshot value and notify useSyncExternalStore
    act(() => {
      mediaQueryState.matches = true;
      changeCallback?.();
    });

    expect(result.current).toBe(true);
  });

  it('updates when media query changes from true to false', () => {
    let changeCallback: (() => void) | null = null;
    const mediaQueryState = { matches: true };

    matchMediaMock.mockImplementation(() => ({
      get matches() { return mediaQueryState.matches; },
      addEventListener: (event: string, listener: () => void) => {
        changeCallback = listener;
        addEventListenerMock(event, listener);
      },
      removeEventListener: removeEventListenerMock,
    }));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    // Simulate media query change — update the snapshot value and notify useSyncExternalStore
    act(() => {
      mediaQueryState.matches = false;
      changeCallback?.();
    });

    expect(result.current).toBe(false);
  });
});
