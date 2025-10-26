/**
 * Custom hook for managing animation state machine
 * Handles ticket progression, pause/resume, and visibility
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReducedMotion } from './use-reduced-motion';
import {
  calculateNextColumn,
  shouldAnimate,
  DemoTicket,
} from '@/lib/utils/animation-helpers';

/**
 * Return type for useAnimationState hook
 */
export interface UseAnimationStateReturn {
  tickets: DemoTicket[];
  isPaused: boolean;
  isVisible: boolean;
  prefersReducedMotion: boolean;
  togglePause: () => void;
  setVisible: (visible: boolean) => void;
}

/**
 * Hook for managing animated mini-Kanban state
 * Handles ticket progression every N milliseconds
 *
 * @param initialTickets - Initial ticket configuration
 * @param interval - Time between progressions in milliseconds (default: 10000)
 * @returns Animation state and control functions
 *
 * @example
 * const { tickets, isPaused, togglePause } = useAnimationState(DEMO_TICKETS, 10000);
 */
export function useAnimationState(
  initialTickets: readonly DemoTicket[],
  interval: number = 10000
): UseAnimationStateReturn {
  const [tickets, setTickets] = useState<DemoTicket[]>([...initialTickets]);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const setVisibleCallback = useCallback((visible: boolean) => {
    setIsVisible(visible);
  }, []);

  useEffect(() => {
    if (!shouldAnimate(isPaused, isVisible, prefersReducedMotion)) {
      return;
    }

    const timer = setInterval(() => {
      setTickets(prev =>
        prev.map(ticket => ({
          ...ticket,
          column: calculateNextColumn(ticket.column),
        }))
      );
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, isVisible, prefersReducedMotion, interval]);

  return {
    tickets,
    isPaused,
    isVisible,
    prefersReducedMotion,
    togglePause,
    setVisible: setVisibleCallback,
  };
}
