/**
 * Activity Event Item Component
 * Feature: AIB-172 Project Activity Feed
 *
 * Renders individual activity events with icon, actor, action, and timestamp
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TimelineBadge } from '@/components/timeline/timeline-badge';
import { TimelineContent } from '@/components/timeline/timeline-content';
import { ActivityEventIcon } from './activity-event-icons';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import type {
  ActivityEvent,
  TicketCreatedEvent,
  TicketStageChangedEvent,
  CommentPostedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
} from '@/app/lib/types/activity-event';
import {
  isTicketCreatedEvent,
  isTicketStageChangedEvent,
  isCommentPostedEvent,
  isJobStartedEvent,
  isJobCompletedEvent,
  isJobFailedEvent,
} from '@/app/lib/types/activity-event';

/**
 * Stage display names for user-friendly output
 */
const STAGE_DISPLAY_NAMES: Record<string, string> = {
  INBOX: 'Inbox',
  SPECIFY: 'Specify',
  PLAN: 'Plan',
  BUILD: 'Build',
  VERIFY: 'Verify',
  SHIP: 'Ship',
};

interface ActivityEventItemProps {
  event: ActivityEvent;
  projectId: number;
}

/**
 * Get initials from name for avatar fallback
 */
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Render ticket reference link
 */
function TicketLink({
  ticketKey,
  ticketId,
  projectId,
  isDeleted,
}: {
  ticketKey: string;
  ticketId: string;
  projectId: number;
  isDeleted: boolean;
}) {
  if (isDeleted) {
    return (
      <span className="text-subtext0">
        {ticketKey} <span className="text-xs">(deleted)</span>
      </span>
    );
  }

  return (
    <Link
      href={`/projects/${projectId}/board?ticket=${ticketId}`}
      className="font-medium text-mauve hover:text-lavender hover:underline"
    >
      {ticketKey}
    </Link>
  );
}

/**
 * Render ticket created event
 */
function TicketCreatedContent({
  event,
  projectId,
}: {
  event: TicketCreatedEvent;
  projectId: number;
}) {
  return (
    <span className="text-sm text-text">
      <span className="font-medium">{event.actor.name || event.actor.email}</span>
      {' created '}
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
      {': '}
      <span className="text-subtext0">{event.data.title}</span>
    </span>
  );
}

/**
 * Render ticket stage changed event
 */
function TicketStageChangedContent({
  event,
  projectId,
}: {
  event: TicketStageChangedEvent;
  projectId: number;
}) {
  const toStage = STAGE_DISPLAY_NAMES[event.data.toStage] || event.data.toStage;
  const fromStage = event.data.fromStage
    ? STAGE_DISPLAY_NAMES[event.data.fromStage] || event.data.fromStage
    : null;

  return (
    <span className="text-sm text-text">
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
      {' moved'}
      {fromStage && (
        <>
          {' from '}
          <span className="font-medium">{fromStage}</span>
        </>
      )}
      {' to '}
      <span className="font-medium">{toStage}</span>
    </span>
  );
}

/**
 * Render comment posted event
 */
function CommentPostedContent({
  event,
  projectId,
}: {
  event: CommentPostedEvent;
  projectId: number;
}) {
  return (
    <span className="text-sm text-text">
      <span className="font-medium">{event.actor.name || event.actor.email}</span>
      {' commented on '}
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
      {event.data.isAiBoardMention && (
        <span className="ml-1 text-xs text-mauve">@ai-board</span>
      )}
      {': '}
      <span className="text-subtext0 italic">{event.data.contentPreview}</span>
    </span>
  );
}

/**
 * Render job started event
 */
function JobStartedContent({
  event,
  projectId,
}: {
  event: JobStartedEvent;
  projectId: number;
}) {
  const isQuickImpl = event.data.command === 'quick-impl';

  return (
    <span className="text-sm text-text">
      <span className="font-medium">{event.data.displayName}</span>
      {isQuickImpl && ' \u26A1'}
      {' started for '}
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
    </span>
  );
}

/**
 * Render job completed event
 */
function JobCompletedContent({
  event,
  projectId,
}: {
  event: JobCompletedEvent;
  projectId: number;
}) {
  const isQuickImpl = event.data.command === 'quick-impl';

  return (
    <span className="text-sm text-text">
      <span className="font-medium">{event.data.displayName}</span>
      {isQuickImpl && ' \u26A1'}
      {' '}
      <span className="text-green-500 font-medium">completed</span>
      {' for '}
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
      {event.data.durationMs && (
        <span className="text-subtext0 ml-1">
          ({formatDuration(event.data.durationMs)})
        </span>
      )}
    </span>
  );
}

/**
 * Render job failed event
 */
function JobFailedContent({
  event,
  projectId,
}: {
  event: JobFailedEvent;
  projectId: number;
}) {
  const isQuickImpl = event.data.command === 'quick-impl';

  return (
    <span className="text-sm text-text">
      <span className="font-medium">{event.data.displayName}</span>
      {isQuickImpl && ' \u26A1'}
      {' '}
      <span className="text-red-500 font-medium">failed</span>
      {' for '}
      <TicketLink
        ticketKey={event.ticket.ticketKey}
        ticketId={event.ticket.ticketId}
        projectId={projectId}
        isDeleted={event.ticket.isDeleted}
      />
      {event.data.durationMs && (
        <span className="text-subtext0 ml-1">
          ({formatDuration(event.data.durationMs)})
        </span>
      )}
    </span>
  );
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Activity event item with icon, content, and timestamp
 *
 * Memoized for performance (prevents re-renders when other events update)
 */
export const ActivityEventItem = React.memo(function ActivityEventItem({
  event,
  projectId,
}: ActivityEventItemProps) {
  // Render content based on event type
  const renderContent = () => {
    if (isTicketCreatedEvent(event)) {
      return <TicketCreatedContent event={event} projectId={projectId} />;
    }
    if (isTicketStageChangedEvent(event)) {
      return <TicketStageChangedContent event={event} projectId={projectId} />;
    }
    if (isCommentPostedEvent(event)) {
      return <CommentPostedContent event={event} projectId={projectId} />;
    }
    if (isJobStartedEvent(event)) {
      return <JobStartedContent event={event} projectId={projectId} />;
    }
    if (isJobCompletedEvent(event)) {
      return <JobCompletedContent event={event} projectId={projectId} />;
    }
    if (isJobFailedEvent(event)) {
      return <JobFailedContent event={event} projectId={projectId} />;
    }
    return null;
  };

  // Determine if we should show avatar or event icon
  const showAvatar = event.type === 'comment_posted' || event.type === 'ticket_created';

  return (
    <li className="relative pl-12">
      {showAvatar ? (
        <TimelineBadge variant="avatar">
          <Avatar className="w-8 h-8">
            <AvatarImage
              src={event.actor.image || undefined}
              alt={event.actor.name || event.actor.email}
            />
            <AvatarFallback className="text-xs bg-surface0 text-text">
              {event.actor.isSystem ? 'AI' : getInitials(event.actor.name)}
            </AvatarFallback>
          </Avatar>
        </TimelineBadge>
      ) : (
        <TimelineBadge variant="event">
          <ActivityEventIcon type={event.type} />
        </TimelineBadge>
      )}
      <TimelineContent>
        {renderContent()}
        <time className="ml-2 text-xs text-subtext0" dateTime={event.timestamp}>
          {formatTimestamp(event.timestamp)}
        </time>
      </TimelineContent>
    </li>
  );
});
