/**
 * Custom hook to detect prefers-reduced-motion preference
 * Respects user's accessibility settings for animations
 */

'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Hook to detect if user prefers reduced motion
 * Uses useSyncExternalStore to subscribe to the prefers-reduced-motion media query.
 *
 * @returns True if user has prefers-reduced-motion: reduce enabled
 *
 * @example
 * const prefersReducedMotion = useReducedMotion();
 * if (prefersReducedMotion) {
 *   // Disable animations or use simplified transitions
 * }
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
