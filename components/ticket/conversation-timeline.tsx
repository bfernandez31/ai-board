/**
 * Conversation Timeline Container Component
 * Feature: 065-915-conversations-je
 *
 * Top-level container that fetches and displays unified conversation timeline
 */

'use client';

import React from 'react';
import { useConversationTimeline } from '@/app/lib/hooks/queries/use-conversation-timeline';
import { Timeline } from '@/components/timeline/timeline';
import { TimelineItem } from '@/components/timeline/timeline-item';
import type { ConversationEvent } from '@/app/lib/types/conversation-event';

interface ConversationTimelineProps {
  ticketId: number;
  projectId: number;
}

/**
 * Generate unique key for timeline event
 * Format: "{type}-{id}-{eventType?}"
 */
function getEventKey(event: ConversationEvent): string {
  if (event.type === 'comment') {
    return `comment-${event.data.id}`;
  } else {
    // Job events need eventType in key since each job creates 2 events (start + completion)
    return `job-${event.data.id}-${event.eventType}`;
  }
}

/**
 * Timeline skeleton loading state
 */
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-surface0" />
          <div className="flex-1 h-16 bg-surface0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Conversation timeline container with loading/error/empty states
 *
 * Features:
 * - Auto-fetches timeline data with TanStack Query
 * - 10-second polling for real-time updates
 * - Displays loading skeleton while fetching
 * - Shows error message on failure
 * - Shows empty state when no activity
 *
 * @example
 * <ConversationTimeline ticketId={42} projectId={1} />
 */
export function ConversationTimeline({ ticketId, projectId }: ConversationTimelineProps) {
  const { data, isLoading, error } = useConversationTimeline({
    projectId,
    ticketId,
  });

  // Loading state
  if (isLoading) {
    return <TimelineSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="text-sm text-red">
        Failed to load conversation timeline
      </div>
    );
  }

  // Empty state
  if (!data || data.timeline.length === 0) {
    return (
      <div className="text-sm text-subtext0 text-center py-8">
        No activity yet
      </div>
    );
  }

  // Render timeline
  return (
    <Timeline>
      {data.timeline.map((event) => (
        <TimelineItem
          key={getEventKey(event)}
          event={event}
          mentionedUsers={data.mentionedUsers}
        />
      ))}
    </Timeline>
  );
}
