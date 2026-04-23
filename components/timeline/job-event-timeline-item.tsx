/**
 * Job Event Timeline Item Component
 * Feature: 065-915-conversations-je
 *
 * Displays job lifecycle events (start, complete, fail, cancel) with icons
 */

'use client';

import * as React from 'react';
import { PlayCircle, CheckCircle, XCircle, Ban } from 'lucide-react';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import { getJobEventMessage } from '@/app/lib/utils/conversation-events';
import { LogPreview } from '@/components/logs/log-preview';
import { LogViewer } from '@/components/logs/log-viewer';
import { Button } from '@/components/ui/button';
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
 * Get text color class based on event type and status
 */
function getEventTextColor(eventType: 'start' | 'complete', status: JobStatus): string {
  // Start event always blue (like RUNNING status)
  if (eventType === 'start') {
    return 'text-blue-500';
  }

  // Completion event - color depends on status
  switch (status) {
    case 'COMPLETED':
      return 'text-green-500';
    case 'FAILED':
      return 'text-red-500';
    case 'CANCELLED':
      return 'text-gray-400';
    default:
      return 'text-blue-500';
  }
}

/**
 * Job event icon selector based on event type and status
 *
 * Icons:
 * - Start: PlayCircle (blue)
 * - Complete: CheckCircle (green)
 * - Fail: XCircle (red)
 * - Cancel: Ban (gray)
 */
function JobEventIcon({ eventType, status }: { eventType: 'start' | 'complete'; status: JobStatus }) {
  const colorClass = getEventTextColor(eventType, status);

  // Start event always shows PlayCircle
  if (eventType === 'start') {
    return <PlayCircle className={`w-4 h-4 ${colorClass}`} />;
  }

  // Completion event - icon depends on status
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className={`w-4 h-4 ${colorClass}`} />;
    case 'FAILED':
      return <XCircle className={`w-4 h-4 ${colorClass}`} />;
    case 'CANCELLED':
      return <Ban className={`w-4 h-4 ${colorClass}`} />;
    default:
      // Fallback for PENDING/RUNNING (shouldn't happen for completion events)
      return <PlayCircle className={`w-4 h-4 ${colorClass}`} />;
  }
}

/**
 * Get status word based on event type and status
 */
function getStatusWord(eventType: 'start' | 'complete', status: JobStatus): string {
  if (eventType === 'start') {
    return 'started';
  }

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
    const [logViewerOpen, setLogViewerOpen] = React.useState(false);

    const message = getJobEventMessage(job.command, eventType, job.status);
    const statusWord = getStatusWord(eventType, job.status);
    const messageBeforeStatus = message.substring(0, message.lastIndexOf(statusWord)).trim();

    const isCompletion = eventType === 'complete';
    const hasLogs = job.logStatus === 'AVAILABLE';

    return (
      <li className="relative pl-12">
        <TimelineBadge variant="event">
          <JobEventIcon eventType={eventType} status={job.status} />
        </TimelineBadge>
        <TimelineContent>
          <span className="text-sm text-text">
            {messageBeforeStatus} <strong>{statusWord}</strong>
            <time className="ml-2 text-xs text-subtext0" dateTime={timestamp}>
              {formatRelativeTime(timestamp)}
            </time>
          </span>
          {isCompletion && (
            <>
              <LogPreview logStatus={job.logStatus} logSummary={job.logSummary} jobStatus={job.status} />
              {hasLogs && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1" onClick={() => setLogViewerOpen(true)}>
                  View full logs
                </Button>
              )}
            </>
          )}
        </TimelineContent>
        {hasLogs && (
          <LogViewer
            open={logViewerOpen}
            onOpenChange={setLogViewerOpen}
            jobId={job.id}
            jobCommand={job.command}
            agentType="CLAUDE"
            timestamp={timestamp}
          />
        )}
      </li>
    );
  }
);
