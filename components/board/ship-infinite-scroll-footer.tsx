'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ShipInfiniteScrollState {
  hasMore: boolean; // loaded < total
  isLoading: boolean; // batch in flight
  error: Error | null; // last batch failed → auto-loading paused until Retry
  paused: boolean; // true while a drag is in progress
  onLoadMore: () => void; // no-op when a request is already in flight
}

interface ShipInfiniteScrollFooterProps extends ShipInfiniteScrollState {
  /** The column's own scroll viewport — used as the IntersectionObserver root */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** Loaded ticket count; a change re-observes the sentinel so tall columns keep filling */
  ticketCount: number;
}

/** Pre-load the next batch when the sentinel is within 300px of the viewport bottom */
const ROOT_MARGIN = '0px 0px 300px 0px';

/**
 * Bottom of the SHIP column: an invisible sentinel that auto-loads the next batch
 * when scrolled near, a discreet spinner while loading, and an error + Retry state.
 */
export function ShipInfiniteScrollFooter({
  rootRef,
  ticketCount,
  hasMore,
  isLoading,
  error,
  paused,
  onLoadMore,
}: ShipInfiniteScrollFooterProps) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Recreated whenever a gate or the ticket count changes: observe() emits an
  // initial entry, so a sentinel still in view after a batch lands loads the next one.
  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((entry) => entry.isIntersecting);
        if (isIntersecting && hasMore && !isLoading && !error && !paused) {
          onLoadMore();
        }
      },
      { root: rootRef.current, rootMargin: ROOT_MARGIN }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, error, paused, ticketCount, onLoadMore, rootRef]);

  if (!hasMore) return null;

  return (
    <div aria-live="polite" className="min-h-8 flex flex-col items-center justify-center">
      <div ref={sentinelRef} data-testid="ship-scroll-sentinel" aria-hidden="true" className="h-px w-full" />
      {isLoading ? (
        <div role="status" className="flex items-center justify-center">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading more shipped tickets</span>
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
          Couldn&apos;t load more shipped tickets.
          <Button variant="ghost" size="sm" onClick={onLoadMore}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
