/**
 * Custom hook to detect prefers-reduced-motion preference
 * Respects user's accessibility settings for animations
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion
 * Listens to prefers-reduced-motion media query and updates on change
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers support addEventListener
    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return prefersReducedMotion;
}
