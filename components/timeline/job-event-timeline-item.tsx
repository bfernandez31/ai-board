/**
 * Job Event Timeline Item Component
 * Feature: 065-915-conversations-je
 *
 * Displays job lifecycle events (start, complete, fail, cancel) with icons
 */

'use client';

import React from 'react';
import { PlayCircle, CheckCircle, XCircle, Ban } from 'lucide-react';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import { getJobEventMessage } from '@/app/lib/utils/conversation-events';
import type { Job, JobStatus } from '@prisma/client';

interface JobEventTimelineItemProps {
  job: Job;
  eventType: 'start' | 'complete';
  timestamp: string;
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
 * Job event icon selector based on event type and status
 *
 * Icons:
 * - Start: PlayCircle (blue)
 * - Complete: CheckCircle (green)
 * - Fail: XCircle (red)
 * - Cancel: Ban (subtext0)
 */
function JobEventIcon({ eventType, status }: { eventType: 'start' | 'complete'; status: JobStatus }) {
  // Start event always shows PlayCircle
  if (eventType === 'start') {
    return <PlayCircle className="w-4 h-4 text-blue" />;
  }

  // Completion event - icon depends on status
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green" />;
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red" />;
    case 'CANCELLED':
      return <Ban className="w-4 h-4 text-subtext0" />;
    default:
      // Fallback for PENDING/RUNNING (shouldn't happen for completion events)
      return <PlayCircle className="w-4 h-4 text-blue" />;
  }
}

/**
 * Job event timeline item with minimal styling
 *
 * Displays:
 * - Circular badge with status-specific icon
 * - User-friendly event message (e.g., "Specification generation started")
 * - Quick workflow indicator (⚡) for quick-impl jobs
 * - Relative timestamp
 *
 * Memoized for performance (prevents re-renders when other events update)
 */
export const JobEventTimelineItem = React.memo(
  function JobEventTimelineItem({ job, eventType, timestamp }: JobEventTimelineItemProps) {
    // Generate user-friendly message with workflow indicator
    const message = getJobEventMessage(job.command, eventType, job.status);

    return (
      <li className="relative flex gap-4 items-center">
        <TimelineBadge variant="event">
          <JobEventIcon eventType={eventType} status={job.status} />
        </TimelineBadge>
        <TimelineContent>
          <span className="text-sm text-subtext0">
            {message}
            <time className="ml-2 text-xs text-subtext1" dateTime={timestamp}>
              {formatRelativeTime(timestamp)}
            </time>
          </span>
        </TimelineContent>
      </li>
    );
  }
);
