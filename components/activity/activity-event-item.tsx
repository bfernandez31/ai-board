'use client';

/**
 * Activity Event Item Component
 * Feature: AIB-181-copy-of-project
 *
 * Displays a single activity event with icon, actor, action, ticket reference, and timestamp
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  PlayCircle,
  CheckCircle,
  XCircle,
  Ban,
  MessageSquare,
  PlusCircle,
  ArrowRight,
  GitPullRequest,
  Globe,
  Bot,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  ActivityEvent,
  JobActivityEvent,
  CommentActivityEvent,
  TicketCreatedActivityEvent,
  StageChangedActivityEvent,
  PRCreatedActivityEvent,
  PreviewDeployedActivityEvent,
} from '@/app/lib/types/activity-event';
import type { JobStatus } from '@prisma/client';

interface ActivityEventItemProps {
  event: ActivityEvent;
  projectId: number;
}

/**
 * Format timestamp to relative time
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
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Format full timestamp for tooltip
 */
function formatFullTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Get initials from name for avatar fallback
 */
function getInitials(name: string | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Job event icon based on event type and status
 */
function JobEventIcon({ eventType, status }: { eventType: 'start' | 'complete'; status: JobStatus }) {
  if (eventType === 'start') {
    return <PlayCircle className="w-4 h-4 text-blue-500" />;
  }

  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'CANCELLED':
      return <Ban className="w-4 h-4 text-gray-400" />;
    default:
      return <PlayCircle className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * Get event icon based on event type
 */
function EventIcon({ event }: { event: ActivityEvent }) {
  switch (event.type) {
    case 'job':
      return <JobEventIcon eventType={event.data.eventType} status={event.data.status} />;
    case 'comment':
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case 'ticket_created':
      return <PlusCircle className="w-4 h-4 text-purple-500" />;
    case 'stage_changed':
      return <ArrowRight className="w-4 h-4 text-blue-400" />;
    case 'pr_created':
      return <GitPullRequest className="w-4 h-4 text-green-500" />;
    case 'preview_deployed':
      return <Globe className="w-4 h-4 text-cyan-500" />;
  }
}

/**
 * Actor display - avatar for users, bot icon for system
 */
function ActorDisplay({ event }: { event: ActivityEvent }) {
  if (event.actor.type === 'system') {
    return (
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
      </div>
    );
  }

  return (
    <Avatar className="w-8 h-8 md:w-10 md:h-10 shrink-0">
      <AvatarImage src={event.actor.image || undefined} alt={event.actor.name} />
      <AvatarFallback className="text-xs">
        {getInitials(event.actor.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Generate event message based on event type
 */
function getEventMessage(event: ActivityEvent): React.ReactNode {
  switch (event.type) {
    case 'job': {
      const jobEvent = event as JobActivityEvent;
      const statusWord = jobEvent.data.eventType === 'start' ? 'started' : getJobStatusWord(jobEvent.data.status);
      return (
        <>
          {jobEvent.data.displayName} <strong>{statusWord}</strong>
        </>
      );
    }
    case 'comment': {
      const commentEvent = event as CommentActivityEvent;
      return (
        <>
          <strong>commented</strong>: &ldquo;{commentEvent.data.content}&rdquo;
        </>
      );
    }
    case 'ticket_created': {
      const ticketEvent = event as TicketCreatedActivityEvent;
      const workflowLabel = ticketEvent.data.workflowType === 'QUICK' ? ' (quick)' : ticketEvent.data.workflowType === 'CLEAN' ? ' (cleanup)' : '';
      return (
        <>
          Ticket <strong>created</strong>{workflowLabel}
        </>
      );
    }
    case 'stage_changed': {
      const stageEvent = event as StageChangedActivityEvent;
      return (
        <>
          Stage changed from <strong>{stageEvent.data.fromStage}</strong> to <strong>{stageEvent.data.toStage}</strong>
        </>
      );
    }
    case 'pr_created': {
      const prEvent = event as PRCreatedActivityEvent;
      return (
        <>
          Pull request <strong>created</strong>
          {prEvent.data.prUrl && (
            <a
              href={prEvent.data.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View PR
            </a>
          )}
        </>
      );
    }
    case 'preview_deployed': {
      const previewEvent = event as PreviewDeployedActivityEvent;
      return (
        <>
          Preview <strong>deployed</strong>
          <a
            href={previewEvent.data.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </a>
        </>
      );
    }
  }
}

function getJobStatusWord(status: JobStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'updated';
  }
}

/**
 * Activity Event Item Component
 *
 * Displays a single event with:
 * - Actor avatar (user or AI-BOARD bot)
 * - Event icon
 * - Event message
 * - Clickable ticket reference
 * - Relative timestamp with tooltip for absolute time
 */
export const ActivityEventItem = React.memo(function ActivityEventItem({
  event,
  projectId,
}: ActivityEventItemProps) {
  const router = useRouter();

  const handleTicketClick = () => {
    router.push(`/projects/${projectId}/board?ticket=${event.ticketKey}&modal=open`);
  };

  return (
    <div className="flex items-start gap-3 md:gap-4 py-3 px-4 md:px-6 hover:bg-surface0/30 transition-colors">
      {/* Actor Avatar */}
      <ActorDisplay event={event} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor name and action */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text text-sm">{event.actor.name}</span>
          <div className="flex items-center gap-1">
            <EventIcon event={event} />
          </div>
        </div>

        {/* Event message */}
        <p className="text-sm text-subtext0 mt-0.5 line-clamp-2">
          {getEventMessage(event)}
        </p>

        {/* Ticket reference and timestamp */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <button
            onClick={handleTicketClick}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline font-mono"
          >
            {event.ticketKey}
            {event.ticketDeleted && <span className="text-subtext0 ml-1">(closed)</span>}
          </button>
          <span className="text-subtext0">·</span>
          <span className="text-xs text-text truncate max-w-[200px]">{event.ticketTitle}</span>
          <span className="text-subtext0">·</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <time
                  dateTime={event.timestamp}
                  className="text-xs text-subtext0 cursor-help"
                >
                  {formatRelativeTime(event.timestamp)}
                </time>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatFullTimestamp(event.timestamp)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
});
