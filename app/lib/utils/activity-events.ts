/**
 * Activity Event Transformation Utilities
 * Feature: AIB-177-project-activity-feed
 *
 * Functions for deriving ActivityEvents from jobs, comments, and tickets,
 * merging them into a unified timeline, and handling pagination.
 */

import type { Job, Comment, Ticket, User, Stage } from '@prisma/client';
import type {
  ActivityEvent,
  Actor,
  TicketReference,
  JobCommand,
  PaginationCursor,
} from '@/app/lib/types/activity-event';

/**
 * Type for Job with required ticket relation for event derivation
 */
export interface JobWithTicket extends Job {
  ticket: Ticket;
}

/**
 * Type for Comment with user relation for event derivation
 */
export interface CommentWithUser extends Comment {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'> | null;
}

/**
 * Type for Ticket with optional user for actor derivation
 * (Note: Tickets don't have userId, so we use project context)
 */
export interface TicketForActivity extends Ticket {
  // Ticket doesn't have direct userId, actor derived from context
}

/**
 * Stage transition mapping for job commands
 * Maps command completion to stage changes
 */
export const COMMAND_STAGE_TRANSITIONS: Partial<
  Record<JobCommand, { fromStage: Stage; toStage: Stage }>
> = {
  specify: { fromStage: 'INBOX', toStage: 'SPECIFY' },
  plan: { fromStage: 'SPECIFY', toStage: 'PLAN' },
  implement: { fromStage: 'PLAN', toStage: 'BUILD' },
  'quick-impl': { fromStage: 'INBOX', toStage: 'BUILD' },
  verify: { fromStage: 'BUILD', toStage: 'VERIFY' },
  // Note: deploy-preview, clean, rollback-reset, comment-* don't advance stages
};

/**
 * Create a user actor from a user record
 *
 * @param user - User record or null for deleted users
 * @returns Actor object with type 'user'
 */
export function createUserActor(
  user: Pick<User, 'id' | 'name' | 'email' | 'image'> | null
): Actor {
  if (!user) {
    return { type: 'user', id: null, name: '[Deleted user]', image: null };
  }
  return {
    type: 'user',
    id: user.id,
    name: user.name || user.email,
    image: user.image,
  };
}

/**
 * Create a system actor for AI-BOARD triggered events
 *
 * @returns Actor object with type 'system'
 */
export function createSystemActor(): Actor {
  return {
    type: 'system',
    id: 'ai-board',
    name: 'AI-BOARD',
    image: null, // Use system icon in UI
  };
}

/**
 * Create a ticket reference from a ticket record
 *
 * @param ticket - Ticket record or null for deleted tickets
 * @param ticketInfo - Fallback info if ticket was deleted but we have cached data
 * @returns TicketReference object
 */
export function createTicketReference(
  ticket: Ticket | null,
  ticketInfo?: { id: number; ticketKey: string }
): TicketReference {
  if (!ticket) {
    return {
      id: ticketInfo?.id ?? 0,
      ticketKey: ticketInfo?.ticketKey ?? '[Unknown]',
      title: '[Deleted ticket]',
      exists: false,
      stage: null,
    };
  }
  return {
    id: ticket.id,
    ticketKey: ticket.ticketKey,
    title: ticket.title,
    exists: true,
    stage: ticket.stage,
  };
}

/**
 * Get stage transition for a job command
 *
 * @param command - Job command string
 * @returns Stage transition or null if command doesn't advance stages
 */
export function getStageTransition(
  command: string
): { fromStage: Stage; toStage: Stage } | null {
  return COMMAND_STAGE_TRANSITIONS[command as JobCommand] || null;
}

/**
 * Derive activity events from a job record
 *
 * Jobs can generate multiple events:
 * - job_started (when startedAt exists and status is not PENDING)
 * - job_completed (when completedAt exists and status is COMPLETED)
 * - job_failed (when completedAt exists and status is FAILED)
 * - stage_changed (when completed job has a stage-advancing command)
 * - pr_created (when verify command completes)
 * - preview_deployed (when deploy-preview command completes)
 *
 * @param job - Job record with ticket relation
 * @returns Array of ActivityEvent derived from the job
 */
export function deriveJobEvents(job: JobWithTicket): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const actor = createSystemActor(); // All jobs are AI-triggered
  const ticket = createTicketReference(job.ticket);

  // Job started event (if startedAt exists and status is not PENDING)
  if (job.startedAt && job.status !== 'PENDING') {
    events.push({
      type: 'job_started',
      id: `job_started_${job.id}`,
      timestamp: job.startedAt.toISOString(),
      actor,
      ticket,
      data: { command: job.command as JobCommand, jobId: job.id },
    });
  }

  // Job completion events (if completedAt exists)
  if (job.completedAt) {
    if (job.status === 'COMPLETED') {
      events.push({
        type: 'job_completed',
        id: `job_completed_${job.id}`,
        timestamp: job.completedAt.toISOString(),
        actor,
        ticket,
        data: {
          command: job.command as JobCommand,
          jobId: job.id,
          durationMs: job.durationMs,
        },
      });

      // Derive stage change for stage-advancing commands
      const stageTransition = getStageTransition(job.command);
      if (stageTransition) {
        events.push({
          type: 'stage_changed',
          id: `stage_changed_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: stageTransition,
        });
      }

      // Derive PR created for verify command
      if (job.command === 'verify') {
        events.push({
          type: 'pr_created',
          id: `pr_created_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: { jobId: job.id },
        });
      }

      // Derive preview deployed for deploy-preview command
      if (job.command === 'deploy-preview') {
        events.push({
          type: 'preview_deployed',
          id: `preview_deployed_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: { jobId: job.id, previewUrl: job.ticket.previewUrl },
        });
      }
    } else if (job.status === 'FAILED') {
      events.push({
        type: 'job_failed',
        id: `job_failed_${job.id}`,
        timestamp: job.completedAt.toISOString(),
        actor,
        ticket,
        data: { command: job.command as JobCommand, jobId: job.id },
      });
    }
    // Note: CANCELLED status is not shown in activity feed per spec
  }

  return events;
}

/**
 * Derive a comment_posted event from a comment record
 *
 * @param comment - Comment record with user relation
 * @param ticket - Ticket the comment belongs to
 * @returns CommentPostedEvent
 */
export function deriveCommentEvent(
  comment: CommentWithUser,
  ticket: Ticket
): ActivityEvent {
  const actor = createUserActor(comment.user);
  const ticketRef = createTicketReference(ticket);

  // Truncate comment content to 100 chars for preview
  const preview =
    comment.content.length > 100
      ? comment.content.substring(0, 100) + '...'
      : comment.content;

  return {
    type: 'comment_posted',
    id: `comment_${comment.id}`,
    timestamp: comment.createdAt.toISOString(),
    actor,
    ticket: ticketRef,
    data: {
      preview,
      commentId: comment.id,
    },
  };
}

/**
 * Derive a ticket_created event from a ticket record
 *
 * @param ticket - Ticket record
 * @returns TicketCreatedEvent
 */
export function deriveTicketCreatedEvent(ticket: Ticket): ActivityEvent {
  // Tickets don't have userId, so we use system actor
  // (Tickets are created through the UI but we don't track who)
  const actor = createSystemActor();
  const ticketRef = createTicketReference(ticket);

  return {
    type: 'ticket_created',
    id: `ticket_created_${ticket.id}`,
    timestamp: ticket.createdAt.toISOString(),
    actor,
    ticket: ticketRef,
    data: {
      title: ticket.title,
    },
  };
}

/**
 * Merge activity events from multiple sources and sort by timestamp
 *
 * @param events - Array of ActivityEvent from all sources
 * @returns Sorted array of events (newest first)
 */
export function mergeActivityEvents(
  events: ActivityEvent[]
): ActivityEvent[] {
  // Sort by timestamp DESC (newest first)
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Encode pagination cursor to base64 string
 *
 * @param cursor - PaginationCursor object
 * @returns base64 encoded string
 */
export function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Decode pagination cursor from base64 string
 *
 * @param encoded - base64 encoded cursor string
 * @returns PaginationCursor object or null if invalid
 */
export function decodeCursor(encoded: string): PaginationCursor | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);

    // Validate cursor structure
    if (
      typeof parsed.timestamp === 'string' &&
      typeof parsed.id === 'string' &&
      typeof parsed.eventType === 'string'
    ) {
      return parsed as PaginationCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply cursor-based pagination to sorted events
 *
 * @param events - Sorted array of events (newest first)
 * @param cursor - Optional pagination cursor
 * @param limit - Maximum number of events to return
 * @returns Object with paginated events, hasMore flag, nextCursor, and cursorExpired
 */
export function applyPagination(
  events: ActivityEvent[],
  cursor: PaginationCursor | null,
  limit: number
): {
  events: ActivityEvent[];
  hasMore: boolean;
  nextCursor: string | null;
  cursorExpired: boolean;
} {
  let startIndex = 0;
  let cursorExpired = false;

  if (cursor) {
    // Find the event matching the cursor
    const cursorIndex = events.findIndex(
      (e) =>
        e.id === cursor.id &&
        e.timestamp === cursor.timestamp &&
        e.type === cursor.eventType
    );

    if (cursorIndex === -1) {
      // Cursor event not found - it may have expired (moved outside 30-day window)
      // Set cursorExpired flag and restart from beginning
      cursorExpired = true;
      startIndex = 0;
    } else {
      // Start after the cursor event
      startIndex = cursorIndex + 1;
    }
  }

  // Get events for this page
  const paginatedEvents = events.slice(startIndex, startIndex + limit);

  // Check if there are more events
  const hasMore = startIndex + limit < events.length;

  // Generate next cursor if there are more events
  let nextCursor: string | null = null;
  if (hasMore && paginatedEvents.length > 0) {
    const lastEvent = paginatedEvents[paginatedEvents.length - 1];
    if (lastEvent) {
      nextCursor = encodeCursor({
        timestamp: lastEvent.timestamp,
        id: lastEvent.id,
        eventType: lastEvent.type,
      });
    }
  }

  return {
    events: paginatedEvents,
    hasMore,
    nextCursor,
    cursorExpired,
  };
}
