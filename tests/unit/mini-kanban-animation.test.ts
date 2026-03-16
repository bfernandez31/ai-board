/**
 * Unit tests for useAnimationState hook
 * Testing continuous animation (no pause functionality)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnimationState } from '@/lib/hooks/use-animation-state';
import type { DemoTicket } from '@/lib/utils/animation-helpers';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

// Mock useReducedMotion hook
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

const TEST_TICKETS: readonly DemoTicket[] = [
  { id: 1, title: 'Test ticket 1', column: 0 },
  { id: 2, title: 'Test ticket 2', column: 2 },
  { id: 3, title: 'Test ticket 3', column: 4 },
] as const;

describe('useAnimationState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes with provided tickets', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    expect(result.current.tickets).toEqual([
      { id: 1, title: 'Test ticket 1', column: 0 },
      { id: 2, title: 'Test ticket 2', column: 2 },
      { id: 3, title: 'Test ticket 3', column: 4 },
    ]);
  });

  it('initializes with isVisible=true', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));
    expect(result.current.isVisible).toBe(true);
  });

  it('does not progress when not visible', async () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    // Set not visible
    act(() => {
      result.current.setVisible(false);
    });

    expect(result.current.isVisible).toBe(false);

    const initialTickets = [...result.current.tickets];

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Tickets should not have progressed
    expect(result.current.tickets).toEqual(initialTickets);
  });

  it('updates visibility state', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.setVisible(false);
    });

    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.setVisible(true);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('does not progress when reduced motion is preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));
    const initialTickets = [...result.current.tickets];

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.tickets).toEqual(initialTickets);
  });
});
