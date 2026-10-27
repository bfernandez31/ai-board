'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseInfiniteScrollTriggerOptions {
  /** Scroll container used as the IntersectionObserver root (column viewport). */
  rootRef: RefObject<HTMLElement | null>;
  /** Element rendered after the last item; loading starts when it nears the root's bottom. */
  sentinelRef: RefObject<HTMLElement | null>;
  /** hasMore && !isLoading && !isError && !paused */
  enabled: boolean;
  onTrigger: () => void;
  /** Distance (px) below the root's visible area at which loading starts. */
  prefetchDistancePx?: number;
}

/**
 * Calls `onTrigger` when the sentinel comes within `prefetchDistancePx` of the
 * bottom of the scroll root, while `enabled`.
 *
 * Auto-fill: the trigger is re-evaluated whenever `enabled` changes, not only on
 * intersection changes. When a batch finishes loading and the sentinel is still
 * near the bottom (content shorter than the column), `enabled` flips back to true
 * and the next batch is requested without any scroll event.
 *
 * The root and sentinel are read from their refs after each commit (never during
 * render), so the observer is (re)attached when the sentinel mounts later.
 */
export function useInfiniteScrollTrigger({
  rootRef,
  sentinelRef,
  enabled,
  onTrigger,
  prefetchDistancePx = 300,
}: UseInfiniteScrollTriggerOptions): void {
  const [isNearBottom, setIsNearBottom] = useState(false);
  const observedRef = useRef<{
    observer: IntersectionObserver;
    root: HTMLElement;
    sentinel: HTMLElement;
    rootMargin: string;
  } | null>(null);
  const rootMargin = `0px 0px ${prefetchDistancePx}px 0px`;

  // Runs after every commit: cheap identity check, reconnects only when needed.
  useEffect(() => {
    const root = rootRef.current;
    const sentinel = sentinelRef.current;
    const current = observedRef.current;
    if (
      current &&
      current.root === root &&
      current.sentinel === sentinel &&
      current.rootMargin === rootMargin
    ) {
      return;
    }

    current?.observer.disconnect();
    observedRef.current = null;
    if (!root || !sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setIsNearBottom(entry.isIntersecting);
      },
      { root, rootMargin, threshold: 0 }
    );
    observer.observe(sentinel);
    observedRef.current = { observer, root, sentinel, rootMargin };
  });

  useEffect(
    () => () => {
      observedRef.current?.observer.disconnect();
      observedRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (isNearBottom && enabled) onTrigger();
  }, [isNearBottom, enabled, onTrigger]);
}
