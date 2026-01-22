'use client';

/**
 * Activity Feed Component
 * Feature: AIB-181-copy-of-project
 *
 * Client component for displaying the activity feed with pagination and polling
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/app/lib/query-keys';
import { ActivityEventItem } from './activity-event-item';
import { ActivityEmptyState } from './activity-empty-state';
import type { ActivityEvent, ActivityFeedResponse } from '@/app/lib/types/activity-event';

interface ActivityFeedProps {
  projectId: number;
}

async function fetchActivityFeed(
  projectId: number,
  limit: number = 50,
  offset: number = 0
): Promise<ActivityFeedResponse> {
  const response = await fetch(
    `/api/projects/${projectId}/activity?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch activity feed');
  }

  return response.json();
}

/**
 * Loading skeleton for activity feed
 */
function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4 py-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 md:gap-4 px-4 md:px-6 animate-pulse">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface0 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface0 rounded w-3/4" />
            <div className="h-3 bg-surface0 rounded w-1/2" />
            <div className="h-3 bg-surface0 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Error state for activity feed
 */
function ActivityFeedError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}

/**
 * Activity Feed Component
 *
 * Displays a list of activity events with:
 * - Loading skeleton while fetching
 * - Empty state when no events
 * - Error state on failure
 * - Pagination via "Load more" button
 * - 15-second polling for real-time updates
 */
export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([]);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Initial fetch with 15-second polling
  const { data, isLoading, error, isError } = useQuery({
    queryKey: queryKeys.projects.activity(projectId),
    queryFn: () => fetchActivityFeed(projectId, 50, 0),
    refetchInterval: 15000, // 15-second polling
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  // Update state when initial data changes
  if (data && currentOffset === 0 && allEvents.length === 0) {
    setAllEvents(data.events);
    setHasMore(data.hasMore);
    setCurrentOffset(data.offset);
  }

  // Merge new polling data with existing events (deduplication)
  if (data && currentOffset > 0) {
    const existingIds = new Set(
      allEvents.map((e) => `${e.type}-${e.timestamp}-${e.ticketKey}`)
    );
    const newEvents = data.events.filter(
      (e) => !existingIds.has(`${e.type}-${e.timestamp}-${e.ticketKey}`)
    );
    if (newEvents.length > 0) {
      // Prepend new events (they're more recent)
      setAllEvents((prev) => [...newEvents, ...prev]);
    }
  }

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const response = await fetchActivityFeed(projectId, 50, currentOffset);
      setAllEvents((prev) => [...prev, ...response.events]);
      setHasMore(response.hasMore);
      setCurrentOffset(response.offset);
    } catch (err) {
      console.error('Failed to load more activity:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Loading state
  if (isLoading && allEvents.length === 0) {
    return <ActivityFeedSkeleton />;
  }

  // Error state
  if (isError) {
    return (
      <ActivityFeedError
        message={error instanceof Error ? error.message : 'Failed to load activity'}
      />
    );
  }

  // Empty state
  const events = allEvents.length > 0 ? allEvents : (data?.events ?? []);
  if (events.length === 0) {
    return <ActivityEmptyState />;
  }

  return (
    <div className="divide-y divide-surface0">
      {/* Event list */}
      {events.map((event, index) => (
        <ActivityEventItem
          key={`${event.type}-${event.timestamp}-${event.ticketKey}-${index}`}
          event={event}
          projectId={projectId}
        />
      ))}

      {/* Load more button */}
      {(hasMore || data?.hasMore) && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
