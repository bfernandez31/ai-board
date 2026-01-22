/**
 * Activity Event Transformation Utilities
 * Feature: AIB-181-copy-of-project
 *
 * Functions for merging and transforming Job, Comment, and Ticket records
 * into unified ActivityEvent timeline.
 */

import type { Job, Comment, Ticket, User, Stage } from '@prisma/client';
import type {
  ActivityEvent,
  JobActivityEvent,
  CommentActivityEvent,
  TicketCreatedActivityEvent,
  Actor,
} from '@/app/lib/types/activity-event';
import { SYSTEM_ACTOR } from '@/app/lib/types/activity-event';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

/**
 * Database types for fetched records
 */
export type JobWithTicket = Job & {
  ticket: Pick<Ticket, 'id' | 'ticketKey' | 'title' | 'closedAt'>;
};

export type CommentWithUserAndTicket = Comment & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
  ticket: Pick<Ticket, 'id' | 'ticketKey' | 'title' | 'closedAt'>;
};

export type TicketForActivity = Pick<
  Ticket,
  'id' | 'ticketKey' | 'title' | 'closedAt' | 'createdAt' | 'workflowType'
>;

/**
 * Create Actor from user record
 */
export function createUserActor(user: Pick<User, 'id' | 'name' | 'email' | 'image'>): Actor {
  return {
    type: 'user',
    id: user.id,
    name: user.name || 'Unknown User',
    email: user.email,
    image: user.image,
  };
}

/**
 * Truncate content for preview display
 * @param content - Full content string
 * @param maxLength - Maximum length (default 100)
 * @returns Truncated content with ellipsis if needed
 */
export function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

/**
 * Create job activity events from Job record
 *
 * Jobs generate 1-2 events:
 * 1. Start event (using job.startedAt timestamp)
 * 2. Completion event (using job.completedAt timestamp) - only if completed
 *
 * @param job - Job record with ticket relation
 * @returns Array of JobActivityEvent (1-2 events)
 */
export function createJobActivityEvents(job: JobWithTicket): JobActivityEvent[] {
  const events: JobActivityEvent[] = [];
  const ticket = job.ticket;
  const displayName = getJobDisplayName(job.command);

  // Start event (always present)
  events.push({
    type: 'job',
    timestamp: job.startedAt.toISOString(),
    ticketKey: ticket.ticketKey,
    ticketTitle: ticket.title,
    ticketId: ticket.id,
    ticketDeleted: ticket.closedAt !== null,
    actor: SYSTEM_ACTOR,
    data: {
      eventType: 'start',
      jobId: job.id,
      command: job.command,
      status: job.status,
      displayName,
    },
  });

  // Completion event (only if job finished)
  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: job.completedAt.toISOString(),
      ticketKey: ticket.ticketKey,
      ticketTitle: ticket.title,
      ticketId: ticket.id,
      ticketDeleted: ticket.closedAt !== null,
      actor: SYSTEM_ACTOR,
      data: {
        eventType: 'complete',
        jobId: job.id,
        command: job.command,
        status: job.status,
        displayName,
      },
    });
  }

  return events;
}

/**
 * Create comment activity event from Comment record
 *
 * @param comment - Comment record with user and ticket relations
 * @returns CommentActivityEvent
 */
export function createCommentActivityEvent(
  comment: CommentWithUserAndTicket
): CommentActivityEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt.toISOString(),
    ticketKey: comment.ticket.ticketKey,
    ticketTitle: comment.ticket.title,
    ticketId: comment.ticket.id,
    ticketDeleted: comment.ticket.closedAt !== null,
    actor: createUserActor(comment.user),
    data: {
      commentId: comment.id,
      content: truncateContent(comment.content),
    },
  };
}

/**
 * Create ticket created activity event from Ticket record
 *
 * @param ticket - Ticket record
 * @returns TicketCreatedActivityEvent
 */
export function createTicketCreatedActivityEvent(
  ticket: TicketForActivity
): TicketCreatedActivityEvent {
  return {
    type: 'ticket_created',
    timestamp: ticket.createdAt.toISOString(),
    ticketKey: ticket.ticketKey,
    ticketTitle: ticket.title,
    ticketId: ticket.id,
    ticketDeleted: ticket.closedAt !== null,
    actor: SYSTEM_ACTOR,
    data: {
      workflowType: ticket.workflowType,
    },
  };
}

/**
 * Stage mapping from job command to expected stage transitions
 */
const COMMAND_TO_STAGE_TRANSITION: Record<string, { from: Stage; to: Stage }> = {
  specify: { from: 'INBOX', to: 'SPECIFY' },
  plan: { from: 'SPECIFY', to: 'PLAN' },
  implement: { from: 'PLAN', to: 'BUILD' },
  'quick-impl': { from: 'INBOX', to: 'BUILD' },
  verify: { from: 'BUILD', to: 'VERIFY' },
  'deploy-preview': { from: 'VERIFY', to: 'VERIFY' }, // No stage change
  ship: { from: 'VERIFY', to: 'SHIP' },
};

/**
 * Check if a job represents a successful stage transition
 */
export function getStageTransition(
  job: Job
): { fromStage: Stage; toStage: Stage } | null {
  if (job.status !== 'COMPLETED') return null;

  const transition = COMMAND_TO_STAGE_TRANSITION[job.command];
  if (!transition) return null;

  // Skip if same stage (no transition)
  if (transition.from === transition.to) return null;

  return { fromStage: transition.from, toStage: transition.to };
}

/**
 * Merge and sort all activity events into unified timeline
 *
 * Performance: O(n log n) for sorting
 * Memory: O(n) for merged array
 *
 * @param jobs - Array of job records with ticket relations
 * @param comments - Array of comment records with user and ticket relations
 * @param tickets - Array of ticket records for creation events
 * @returns Sorted array of ActivityEvent (newest first)
 */
export function mergeActivityEvents(
  jobs: JobWithTicket[],
  comments: CommentWithUserAndTicket[],
  tickets: TicketForActivity[]
): ActivityEvent[] {
  const allEvents: ActivityEvent[] = [];

  // Transform jobs to events (each job creates 1-2 events)
  for (const job of jobs) {
    allEvents.push(...createJobActivityEvents(job));
  }

  // Transform comments to events
  for (const comment of comments) {
    allEvents.push(createCommentActivityEvent(comment));
  }

  // Transform tickets to creation events
  for (const ticket of tickets) {
    allEvents.push(createTicketCreatedActivityEvent(ticket));
  }

  // Sort by timestamp descending (newest first)
  return allEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
