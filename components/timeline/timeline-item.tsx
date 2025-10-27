/**
 * Timeline Item Dispatcher Component
 * Feature: 065-915-conversations-je
 *
 * Dispatcher component that renders appropriate timeline item based on event type
 */

import type { ConversationEvent } from '@/app/lib/types/conversation-event';
import type { User } from '@/app/lib/types/mention';
import { assertNever } from '@/app/lib/types/conversation-event';
import { CommentTimelineItem } from './comment-timeline-item';
import { JobEventTimelineItem } from './job-event-timeline-item';

interface TimelineItemProps {
  event: ConversationEvent;
  mentionedUsers: Record<string, User>;
}

/**
 * Timeline item dispatcher with discriminated union type narrowing
 *
 * Uses switch statement with exhaustive checking (assertNever helper)
 * to ensure all event types are handled at compile time.
 *
 * @example
 * <TimelineItem event={commentEvent} /> // → renders CommentTimelineItem
 * <TimelineItem event={jobEvent} />     // → renders JobEventTimelineItem
 */
export function TimelineItem({ event, mentionedUsers }: TimelineItemProps) {
  switch (event.type) {
    case 'comment':
      return (
        <CommentTimelineItem
          comment={event.data}
          timestamp={event.timestamp}
          mentionedUsers={mentionedUsers}
        />
      );
    case 'job':
      return (
        <JobEventTimelineItem
          job={event.data}
          eventType={event.eventType}
          timestamp={event.timestamp}
        />
      );
    default:
      return assertNever(event);
  }
}
