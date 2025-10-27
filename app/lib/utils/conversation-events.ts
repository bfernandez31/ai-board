/**
 * Conversation Event Transformation Utilities
 * Feature: 065-915-conversations-je
 *
 * Functions for merging and transforming Comment and Job records
 * into unified ConversationEvent timeline.
 */

import type { CommentWithUser } from '@/app/lib/types/comment';
import type { Job, JobStatus } from '@prisma/client';
import type {
  CommentEvent,
  JobEvent,
  ConversationEvent,
} from '@/app/lib/types/conversation-event';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

/**
 * Transform Comment record to CommentEvent
 *
 * @param comment - Comment with user relation
 * @returns CommentEvent with timestamp from createdAt
 */
export function createCommentEvent(comment: CommentWithUser): CommentEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt,
    data: comment,
  };
}

/**
 * Create job events from Job record
 *
 * Jobs generate TWO events:
 * 1. Start event (using job.startedAt timestamp) - always present
 * 2. Completion event (using job.completedAt timestamp) - only if completedAt is not null
 *
 * @param job - Job record from database
 * @returns Array of JobEvent (1-2 events depending on completion status)
 */
export function createJobEvents(job: Job): JobEvent[] {
  const events: JobEvent[] = [];

  // Start event (always present for all jobs)
  events.push({
    type: 'job',
    timestamp: job.startedAt.toISOString(),
    data: job,
    eventType: 'start',
  });

  // Completion event (only if job finished)
  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: job.completedAt.toISOString(),
      data: job,
      eventType: 'complete',
    });
  }

  return events;
}

/**
 * Merge and sort comments + jobs into unified timeline
 *
 * Performance: O(n log n) for sorting, optimized for <100 items
 * Memory: O(n) for merged array
 *
 * @param comments - Array of comments with user relations
 * @param jobs - Array of job records
 * @returns Sorted array of ConversationEvent (chronological order, oldest first)
 */
export function mergeConversationEvents(
  comments: CommentWithUser[],
  jobs: Job[]
): ConversationEvent[] {
  const commentEvents = comments.map(createCommentEvent);
  const jobEvents = jobs.flatMap(createJobEvents); // Each job creates 1-2 events

  // Spread operator optimal for <100 items
  const allEvents = [...commentEvents, ...jobEvents];

  // Single sort by timestamp (chronological order, oldest first)
  return allEvents.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Generate event message for job event based on event type and status
 *
 * @param command - Job command string
 * @param eventType - Type of job event (start or complete)
 * @param status - Current job status
 * @returns User-friendly event message
 *
 * @example
 * getJobEventMessage('specify', 'start', 'RUNNING')
 * // → "Specification generation started"
 *
 * getJobEventMessage('quick-impl', 'complete', 'COMPLETED')
 * // → "Quick implementation ⚡ completed"
 *
 * getJobEventMessage('implement', 'complete', 'FAILED')
 * // → "Implementation failed"
 */
export function getJobEventMessage(
  command: string,
  eventType: 'start' | 'complete',
  status: JobStatus
): string {
  const displayName = getJobDisplayName(command);
  // Quick indicator only for quick-impl command
  const quickIndicator = command === 'quick-impl' ? ' ⚡' : '';

  if (eventType === 'start') {
    return `${displayName}${quickIndicator} started`;
  }

  // Completion event - message depends on status
  switch (status) {
    case 'COMPLETED':
      return `${displayName}${quickIndicator} completed`;
    case 'FAILED':
      return `${displayName}${quickIndicator} failed`;
    case 'CANCELLED':
      return `${displayName}${quickIndicator} cancelled`;
    default:
      // PENDING/RUNNING should not have completion events
      return `${displayName}${quickIndicator} updated`;
  }
}
