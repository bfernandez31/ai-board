'use client';

/**
 * Activity Item Component
 * Feature: AIB-177-project-activity-feed
 *
 * Renders individual activity events with appropriate icons, actors, and formatting.
 * Uses discriminated union pattern for type-safe event handling.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  ArrowRight,
  MessageSquare,
  PlayCircle,
  CheckCircle,
  XCircle,
  GitPullRequest,
  Globe,
  Bot,
} from 'lucide-react';
import { Avatar as ShadcnAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ActivityEvent } from '@/app/lib/types/activity-event';
import { assertNever } from '@/app/lib/types/activity-event';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

interface ActivityItemProps {
  event: ActivityEvent;
  projectId: number;
}

/**
 * Format timestamp to relative time
 * (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Format absolute timestamp for hover title
 */
function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Get initials from a name (first letters of first two words)
 */
function getInitials(name: string | null): string {
  if (!name) return '?';

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    const firstWord = words[0];
    if (!firstWord) return '?';
    return firstWord.charAt(0).toUpperCase();
  }

  const firstWord = words[0];
  const secondWord = words[1];
  if (!firstWord || !secondWord) return '?';
  return (firstWord.charAt(0) + secondWord.charAt(0)).toUpperCase();
}

/**
 * Actor avatar component
 */
function ActorAvatar({ actor }: { actor: ActivityEvent['actor'] }) {
  if (actor.type === 'system') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20">
        <Bot className="h-4 w-4 text-violet-400" />
      </div>
    );
  }

  return (
    <ShadcnAvatar className="h-8 w-8">
      {actor.image && <AvatarImage src={actor.image} alt={actor.name} />}
      <AvatarFallback className="bg-blue/20 text-blue text-xs">
        {getInitials(actor.name)}
      </AvatarFallback>
    </ShadcnAvatar>
  );
}

/**
 * Event icon based on type
 */
function EventIcon({ type }: { type: ActivityEvent['type'] }) {
  switch (type) {
    case 'ticket_created':
      return <PlusCircle className="h-4 w-4 text-green-400" />;
    case 'stage_changed':
      return <ArrowRight className="h-4 w-4 text-blue-400" />;
    case 'comment_posted':
      return <MessageSquare className="h-4 w-4 text-yellow-400" />;
    case 'job_started':
      return <PlayCircle className="h-4 w-4 text-blue-400" />;
    case 'job_completed':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'job_failed':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'pr_created':
      return <GitPullRequest className="h-4 w-4 text-purple-400" />;
    case 'preview_deployed':
      return <Globe className="h-4 w-4 text-cyan-400" />;
    default:
      return assertNever(type);
  }
}

/**
 * Ticket link component
 */
function TicketLink({
  ticket,
  projectId,
}: {
  ticket: ActivityEvent['ticket'];
  projectId: number;
}) {
  if (!ticket.exists) {
    return <span className="text-muted-foreground">{ticket.ticketKey}</span>;
  }

  return (
    <Link
      href={`/projects/${projectId}/board?ticket=${ticket.ticketKey}`}
      className="font-medium text-violet-400 hover:text-violet-300 hover:underline"
    >
      {ticket.ticketKey}
    </Link>
  );
}

/**
 * Stage badge for stage changes
 */
function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    INBOX: 'bg-zinc-600/50 text-zinc-300',
    SPECIFY: 'bg-blue-600/50 text-blue-300',
    PLAN: 'bg-violet-600/50 text-violet-300',
    BUILD: 'bg-green-600/50 text-green-300',
    VERIFY: 'bg-yellow-600/50 text-yellow-300',
    SHIP: 'bg-cyan-600/50 text-cyan-300',
    CLOSED: 'bg-zinc-600/50 text-zinc-300',
  };

  return (
    <Badge variant="outline" className={`text-xs ${colors[stage] || ''}`}>
      {stage}
    </Badge>
  );
}

/**
 * Render event message based on type
 */
function EventMessage({
  event,
  projectId,
}: {
  event: ActivityEvent;
  projectId: number;
}) {
  switch (event.type) {
    case 'ticket_created':
      return (
        <span>
          created ticket <TicketLink ticket={event.ticket} projectId={projectId} />
        </span>
      );

    case 'stage_changed':
      return (
        <span className="flex flex-wrap items-center gap-1">
          moved <TicketLink ticket={event.ticket} projectId={projectId} /> from{' '}
          <StageBadge stage={event.data.fromStage} /> to{' '}
          <StageBadge stage={event.data.toStage} />
        </span>
      );

    case 'comment_posted':
      return (
        <span>
          commented on <TicketLink ticket={event.ticket} projectId={projectId} />
          <span className="ml-2 text-muted-foreground text-sm italic truncate max-w-[200px] inline-block align-bottom">
            &quot;{event.data.preview}&quot;
          </span>
        </span>
      );

    case 'job_started':
      return (
        <span>
          started <strong>{getJobDisplayName(event.data.command)}</strong> for{' '}
          <TicketLink ticket={event.ticket} projectId={projectId} />
        </span>
      );

    case 'job_completed':
      return (
        <span>
          completed <strong>{getJobDisplayName(event.data.command)}</strong> for{' '}
          <TicketLink ticket={event.ticket} projectId={projectId} />
          {event.data.durationMs && (
            <span className="ml-1 text-muted-foreground text-xs">
              ({Math.round(event.data.durationMs / 1000)}s)
            </span>
          )}
        </span>
      );

    case 'job_failed':
      return (
        <span>
          <strong className="text-red-400">{getJobDisplayName(event.data.command)} failed</strong>{' '}
          for <TicketLink ticket={event.ticket} projectId={projectId} />
        </span>
      );

    case 'pr_created':
      return (
        <span>
          created PR for <TicketLink ticket={event.ticket} projectId={projectId} />
        </span>
      );

    case 'preview_deployed':
      return (
        <span>
          deployed preview for{' '}
          <TicketLink ticket={event.ticket} projectId={projectId} />
          {event.data.previewUrl && (
            <a
              href={event.data.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-cyan-400 hover:text-cyan-300 hover:underline text-sm"
            >
              View preview
            </a>
          )}
        </span>
      );

    default:
      return assertNever(event);
  }
}

/**
 * Activity Item - renders a single activity event
 *
 * Memoized for performance (prevents re-renders when other events update)
 */
export const ActivityItem = React.memo(function ActivityItem({
  event,
  projectId,
}: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-zinc-800/50 rounded-lg transition-colors min-h-[52px]">
      {/* Actor Avatar */}
      <ActorAvatar actor={event.actor} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Event Icon */}
          <EventIcon type={event.type} />

          {/* Actor Name */}
          <span className="font-medium text-zinc-200">{event.actor.name}</span>

          {/* Event Message */}
          <span className="text-zinc-400">
            <EventMessage event={event} projectId={projectId} />
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <time
        dateTime={event.timestamp}
        title={formatAbsoluteTime(event.timestamp)}
        className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0"
      >
        {formatRelativeTime(event.timestamp)}
      </time>
    </div>
  );
});
