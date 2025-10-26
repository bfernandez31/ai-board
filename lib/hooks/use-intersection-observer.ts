/**
 * Custom hook for Intersection Observer API
 * Detects when an element enters or leaves the viewport
 */

'use client';

import { useEffect, useState, RefObject } from 'react';

/**
 * Hook to detect when an element is visible in the viewport
 * Uses Intersection Observer API for performance
 *
 * @param ref - React ref to the element to observe
 * @param options - Intersection Observer options
 * @returns True if element is visible in viewport
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const isVisible = useIntersectionObserver(ref, { threshold: 0.1 });
 */
export function useIntersectionObserver(
  ref: RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check if Intersection Observer is available
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: assume visible if API not available
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsVisible(entry.isIntersecting);
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isVisible;
}
