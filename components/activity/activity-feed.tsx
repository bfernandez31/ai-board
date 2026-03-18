'use client';

/**
 * Activity Feed Component
 * Feature: AIB-177-project-activity-feed
 *
 * Client component that displays the activity feed with polling and pagination.
 */

import { useCallback, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ActivityItem } from './activity-item';
import { ActivityEmptyState } from './activity-empty-state';
import {
  useProjectActivity,
  flattenActivityEvents,
} from '@/app/lib/hooks/queries/use-project-activity';
import type { ActivityEvent, ActivityFeedResponse } from '@/app/lib/types/activity-event';

interface ActivityFeedProps {
  projectId: number;
  initialData?: ActivityFeedResponse;
}

const INITIAL_LIMIT = 50;

/**
 * Activity Feed - displays project activity with polling and pagination
 *
 * Features:
 * - 15-second polling for real-time updates
 * - "Load more" pagination
 * - Smart merging of new events during polling
 * - Empty state when no activity
 * - Loading and error states
 */
export function ActivityFeed({ projectId, initialData }: ActivityFeedProps) {
  const { toast } = useToast();
  const [displayedEvents, setDisplayedEvents] = useState<ActivityEvent[]>(
    initialData?.events ?? []
  );
  const [hasPaginated, setHasPaginated] = useState(false);

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProjectActivity({
    projectId,
    limit: INITIAL_LIMIT,
    enabled: true,
    refetchInterval: 15000,
  });

  // Handle cursor expiration from API response
  useEffect(() => {
    const lastPage = data?.pages[data.pages.length - 1];
    if (lastPage?.pagination.cursorExpired) {
      toast({
        title: 'Activity refreshed',
        description: 'Your position was reset due to new activity.',
        variant: 'default',
      });
      // Reset pagination state — syncs polled data cursor expiration with local UI state
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasPaginated(false);
    }
  }, [data, toast]);

  // Merge polling updates with displayed events
  useEffect(() => {
    if (!data) return;

    const fetchedEvents = flattenActivityEvents(data);

    if (!hasPaginated) {
      // User hasn't paginated yet - replace with fresh data from poll
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedEvents(fetchedEvents);
    } else {
      // User has paginated - merge new events at the top
      setDisplayedEvents((prev) => {
        // Find new events that aren't in the current list
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = fetchedEvents.filter((e) => !existingIds.has(e.id));

        if (newEvents.length === 0) {
          return prev;
        }

        // Prepend new events
        const merged = [...newEvents, ...prev];

        // Sort by timestamp DESC
        return merged.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    }
  }, [data, hasPaginated]);

  // Handle "Load more" click
  const handleLoadMore = useCallback(() => {
    setHasPaginated(true);
    fetchNextPage();
  }, [fetchNextPage]);

  // Loading state
  if (isLoading && displayedEvents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-red-400 mb-4">Failed to load activity feed</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (displayedEvents.length === 0) {
    return <ActivityEmptyState />;
  }

  return (
    <div className="space-y-1">
      {/* Event List */}
      <div className="divide-y divide-zinc-800/50">
        {displayedEvents.map((event) => (
          <ActivityItem key={event.id} event={event} projectId={projectId} />
        ))}
      </div>

      {/* Load More Button */}
      {hasNextPage && (
        <div className="flex justify-center pt-4 pb-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isFetchingNextPage}
            className="min-w-[120px] min-h-[44px]"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}

      {/* Total count info */}
      {data?.pages[0]?.pagination.totalCount !== undefined && (
        <p className="text-center text-xs text-muted-foreground py-2">
          Showing {displayedEvents.length} of {data.pages[0].pagination.totalCount} events
        </p>
      )}
    </div>
  );
}
