/**
 * Activity Feed Container Component
 * Feature: AIB-172 Project Activity Feed
 *
 * Main container that fetches and displays activity events in a timeline format
 */

'use client';

import * as React from 'react';
import { useRef, useCallback } from 'react';
import { Timeline } from '@/components/timeline/timeline';
import { ActivityEventItem } from './activity-event-item';
import { ActivityEmptyState } from './activity-empty-state';
import { useActivityFeed } from '@/app/lib/hooks/queries/use-activity-feed';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ActivityEvent } from '@/app/lib/types/activity-event';

interface ActivityFeedProps {
  projectId: number;
  initialLimit?: number;
}

/**
 * Activity feed container with data fetching and pagination
 *
 * Features:
 * - Fetches activity events via TanStack Query
 * - 15-second polling for real-time updates
 * - Scroll position preservation during updates
 * - Load more button for pagination
 * - Responsive layout (full-width desktop, compact mobile)
 *
 * @param projectId - Project ID to fetch activity for
 * @param initialLimit - Initial page size (default: 50)
 */
export function ActivityFeed({ projectId, initialLimit = 50 }: ActivityFeedProps) {
  const [loadedEvents, setLoadedEvents] = React.useState<ActivityEvent[]>([]);
  const [offset, setOffset] = React.useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const { data, isLoading, isError, error, isFetching } = useActivityFeed({
    projectId,
    offset: 0,
    limit: initialLimit,
  });

  // Update loaded events when data changes (preserving scroll position)
  React.useEffect(() => {
    if (data?.events && offset === 0) {
      // Save scroll position before update
      if (containerRef.current) {
        scrollPositionRef.current = containerRef.current.scrollTop;
      }

      setLoadedEvents(data.events);

      // Restore scroll position after update (next tick)
      requestAnimationFrame(() => {
        if (containerRef.current && scrollPositionRef.current > 0) {
          containerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [data?.events, offset]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (!data) return;

    const nextOffset = loadedEvents.length;
    const response = await fetch(
      `/api/projects/${projectId}/activity?offset=${nextOffset}&limit=${initialLimit}`
    );

    if (response.ok) {
      const moreData = await response.json();
      setLoadedEvents((prev) => [...prev, ...moreData.events]);
      setOffset(nextOffset);
    }
  }, [data, loadedEvents.length, projectId, initialLimit]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-mauve" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-red-500 mb-2">Failed to load activity</p>
        <p className="text-sm text-subtext0">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
      </div>
    );
  }

  // Empty state
  if (!data?.events || data.events.length === 0) {
    return <ActivityEmptyState />;
  }

  // Determine events to display (use loaded events if pagination happened, otherwise use data)
  const eventsToDisplay = loadedEvents.length > 0 ? loadedEvents : data.events;
  const hasMore = data.pagination.hasMore || loadedEvents.length < data.pagination.total;

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-3xl mx-auto px-4 md:px-6"
    >
      {/* Polling indicator */}
      {isFetching && !isLoading && (
        <div className="absolute top-0 right-4 md:right-6">
          <div className="flex items-center gap-1 text-xs text-subtext0">
            <div className="w-2 h-2 rounded-full bg-mauve animate-pulse" />
            Updating
          </div>
        </div>
      )}

      {/* Timeline of events */}
      <Timeline className="py-4">
        {eventsToDisplay.map((event) => (
          <ActivityEventItem
            key={event.id}
            event={event}
            projectId={projectId}
          />
        ))}
      </Timeline>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-4 border-t border-surface0">
          <Button
            variant="ghost"
            onClick={handleLoadMore}
            disabled={isFetching}
            className="text-mauve hover:text-lavender"
          >
            {isFetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more activity'
            )}
          </Button>
        </div>
      )}

      {/* Event count */}
      <div className="text-center py-4 text-xs text-subtext0">
        Showing {eventsToDisplay.length} of {data.pagination.total} events
      </div>
    </div>
  );
}
