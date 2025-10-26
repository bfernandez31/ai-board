/**
 * Unit tests for useAnimationState hook
 * Testing animation state machine logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnimationState } from '@/lib/hooks/use-animation-state';
import type { DemoTicket } from '@/lib/utils/animation-helpers';

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

  it('initializes with isPaused=false', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));
    expect(result.current.isPaused).toBe(false);
  });

  it('initializes with isVisible=true', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));
    expect(result.current.isVisible).toBe(true);
  });

  it('progresses tickets after interval', async () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    // Fast-forward time by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.tickets).toEqual([
        { id: 1, title: 'Test ticket 1', column: 1 }, // 0 → 1
        { id: 2, title: 'Test ticket 2', column: 3 }, // 2 → 3
        { id: 3, title: 'Test ticket 3', column: 5 }, // 4 → 5
      ]);
    });
  });

  it('wraps tickets from column 5 to 0', async () => {
    const wrappingTickets: readonly DemoTicket[] = [
      { id: 1, title: 'Ticket at end', column: 5 },
    ];

    const { result } = renderHook(() => useAnimationState(wrappingTickets, 10000));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.tickets[0].column).toBe(0);
    });
  });

  it('does not progress when paused', async () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    // Pause animation
    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(true);

    const initialTickets = [...result.current.tickets];

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Tickets should not have progressed
    expect(result.current.tickets).toEqual(initialTickets);
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

  it('toggles pause state', () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(false);
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

  it('uses custom interval', async () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 5000));

    // Fast-forward by 5 seconds (custom interval)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.tickets[0].column).toBe(1);
    });
  });

  it('resumes animation after being paused', async () => {
    const { result } = renderHook(() => useAnimationState(TEST_TICKETS, 10000));

    // Pause
    act(() => {
      result.current.togglePause();
    });

    // Fast-forward (no progress expected)
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    const pausedTickets = [...result.current.tickets];

    // Resume
    act(() => {
      result.current.togglePause();
    });

    // Fast-forward again
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(result.current.tickets).not.toEqual(pausedTickets);
      expect(result.current.tickets[0].column).toBe(1);
    });
  });
});
