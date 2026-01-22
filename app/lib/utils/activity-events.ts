/**
 * Activity Event Utilities
 * Feature: AIB-172 Project Activity Feed
 *
 * Functions for generating event IDs, transforming database records
 * to activity events, and merging/sorting events.
 */

import type { Job, Comment, Ticket, User, Stage } from '@prisma/client';
import type {
  ActivityEvent,
  Actor,
  TicketReference,
  TicketCreatedEvent,
  TicketStageChangedEvent,
  CommentPostedEvent,
  JobStartedEvent,
  JobCompletedEvent,
  JobFailedEvent,
} from '@/app/lib/types/activity-event';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

// ============================================================================
// Event ID Generation (T005)
// ============================================================================

/**
 * Event ID prefixes for each event type
 * Format: {prefix}_{sourceId}
 */
const EVENT_ID_PREFIXES = {
  ticket_created: 'tc',
  ticket_stage_changed: 'tsc',
  comment_posted: 'cp',
  job_started: 'js',
  job_completed: 'jc',
  job_failed: 'jf',
} as const;

/**
 * Generate unique event ID from event type and source record ID
 *
 * @param type - Activity event type
 * @param sourceId - Source record ID (ticket ID, comment ID, or job ID)
 * @returns Unique event identifier
 *
 * @example
 * generateEventId('ticket_created', 'cuid123') // → "tc_cuid123"
 * generateEventId('job_started', 'cuid456') // → "js_cuid456"
 */
export function generateEventId(
  type: keyof typeof EVENT_ID_PREFIXES,
  sourceId: string
): string {
  const prefix = EVENT_ID_PREFIXES[type];
  return `${prefix}_${sourceId}`;
}

// ============================================================================
// Actor Creation
// ============================================================================

/**
 * Create Actor from User record
 *
 * @param user - User record with optional name/image
 * @param isSystem - Whether this is a system actor (AI-BOARD)
 * @returns Actor object
 */
export function createActor(
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>,
  isSystem = false
): Actor {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isSystem,
  };
}

/**
 * Create placeholder actor for deleted users
 */
export function createDeletedUserActor(userId: string): Actor {
  return {
    id: userId,
    name: 'Deleted user',
    email: 'deleted@example.com',
    image: null,
    isSystem: false,
  };
}

/**
 * Create AI-BOARD system actor
 */
export function createAiBoardActor(userId: string): Actor {
  return {
    id: userId,
    name: 'AI-BOARD',
    email: 'ai-board@system.local',
    image: null,
    isSystem: true,
  };
}

// ============================================================================
// Ticket Reference Creation
// ============================================================================

/**
 * Create TicketReference from Ticket record
 *
 * @param ticket - Ticket record with ticketKey
 * @param isDeleted - Whether the ticket has been deleted
 * @returns TicketReference object
 */
export function createTicketReference(
  ticket: Pick<Ticket, 'id' | 'ticketKey'>,
  isDeleted = false
): TicketReference {
  return {
    ticketKey: ticket.ticketKey,
    ticketId: ticket.id.toString(),
    isDeleted,
  };
}

// ============================================================================
// Event Transformation (T003)
// ============================================================================

/**
 * Ticket record with user relation for event transformation
 */
type TicketWithUser = Ticket & {
  user?: Pick<User, 'id' | 'name' | 'email' | 'image'> | null;
};

/**
 * Transform Ticket record to TicketCreatedEvent
 *
 * @param ticket - Ticket record with user relation
 * @param actor - Actor who created the ticket
 * @returns TicketCreatedEvent
 */
export function transformTicketToCreatedEvent(
  ticket: TicketWithUser,
  actor: Actor
): TicketCreatedEvent {
  return {
    id: generateEventId('ticket_created', ticket.id.toString()),
    type: 'ticket_created',
    timestamp: ticket.createdAt.toISOString(),
    actor,
    ticket: createTicketReference(ticket),
    projectId: ticket.projectId.toString(),
    data: {
      title: ticket.title,
    },
  };
}

/**
 * Transform Ticket record to TicketStageChangedEvent
 * Only created if updatedAt > createdAt (indicates a stage change)
 *
 * @param ticket - Ticket record
 * @param actor - Actor who changed the stage (AI-BOARD for automated transitions)
 * @param fromStage - Previous stage (optional)
 * @returns TicketStageChangedEvent or null if no stage change detected
 */
export function transformTicketToStageChangedEvent(
  ticket: TicketWithUser,
  actor: Actor,
  fromStage?: Stage
): TicketStageChangedEvent | null {
  // Only create stage change event if ticket was updated after creation
  if (ticket.updatedAt.getTime() <= ticket.createdAt.getTime()) {
    return null;
  }

  return {
    id: generateEventId('ticket_stage_changed', ticket.id.toString()),
    type: 'ticket_stage_changed',
    timestamp: ticket.updatedAt.toISOString(),
    actor,
    ticket: createTicketReference(ticket),
    projectId: ticket.projectId.toString(),
    data: {
      toStage: ticket.stage,
      ...(fromStage !== undefined && { fromStage }),
    },
  };
}

/**
 * Comment record with user and ticket relations
 */
type CommentWithRelations = Comment & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
  ticket: Pick<Ticket, 'id' | 'ticketKey' | 'projectId'>;
};

/**
 * Transform Comment record to CommentPostedEvent
 *
 * @param comment - Comment record with user and ticket relations
 * @returns CommentPostedEvent
 */
export function transformCommentToEvent(
  comment: CommentWithRelations
): CommentPostedEvent {
  const contentPreview =
    comment.content.length > 100
      ? comment.content.substring(0, 100) + '...'
      : comment.content;

  const isAiBoardMention = comment.content
    .toLowerCase()
    .includes('@ai-board');

  return {
    id: generateEventId('comment_posted', comment.id.toString()),
    type: 'comment_posted',
    timestamp: comment.createdAt.toISOString(),
    actor: createActor(comment.user),
    ticket: createTicketReference(comment.ticket),
    projectId: comment.ticket.projectId.toString(),
    data: {
      contentPreview,
      isAiBoardMention,
    },
  };
}

/**
 * Job record with ticket relation
 */
type JobWithTicket = Job & {
  ticket: Pick<Ticket, 'id' | 'ticketKey' | 'projectId'>;
};

/**
 * Transform Job record to JobStartedEvent
 * Only created if job has startedAt timestamp
 *
 * @param job - Job record with ticket relation
 * @param actor - Actor (usually AI-BOARD for workflow jobs)
 * @returns JobStartedEvent or null if no startedAt
 */
export function transformJobToStartedEvent(
  job: JobWithTicket,
  actor: Actor
): JobStartedEvent | null {
  if (!job.startedAt) {
    return null;
  }

  return {
    id: generateEventId('job_started', job.id.toString()),
    type: 'job_started',
    timestamp: job.startedAt.toISOString(),
    actor,
    ticket: createTicketReference(job.ticket),
    projectId: job.projectId.toString(),
    data: {
      command: job.command,
      displayName: getJobDisplayName(job.command),
    },
  };
}

/**
 * Transform Job record to JobCompletedEvent
 * Only created if job status is COMPLETED and has completedAt
 *
 * @param job - Job record with ticket relation
 * @param actor - Actor (usually AI-BOARD for workflow jobs)
 * @returns JobCompletedEvent or null if not completed
 */
export function transformJobToCompletedEvent(
  job: JobWithTicket,
  actor: Actor
): JobCompletedEvent | null {
  if (job.status !== 'COMPLETED' || !job.completedAt) {
    return null;
  }

  return {
    id: generateEventId('job_completed', job.id.toString()),
    type: 'job_completed',
    timestamp: job.completedAt.toISOString(),
    actor,
    ticket: createTicketReference(job.ticket),
    projectId: job.projectId.toString(),
    data: {
      command: job.command,
      displayName: getJobDisplayName(job.command),
      ...(job.startedAt && {
        durationMs: job.completedAt.getTime() - job.startedAt.getTime(),
      }),
    },
  };
}

/**
 * Transform Job record to JobFailedEvent
 * Only created if job status is FAILED and has completedAt
 *
 * @param job - Job record with ticket relation
 * @param actor - Actor (usually AI-BOARD for workflow jobs)
 * @returns JobFailedEvent or null if not failed
 */
export function transformJobToFailedEvent(
  job: JobWithTicket,
  actor: Actor
): JobFailedEvent | null {
  if (job.status !== 'FAILED' || !job.completedAt) {
    return null;
  }

  return {
    id: generateEventId('job_failed', job.id.toString()),
    type: 'job_failed',
    timestamp: job.completedAt.toISOString(),
    actor,
    ticket: createTicketReference(job.ticket),
    projectId: job.projectId.toString(),
    data: {
      command: job.command,
      displayName: getJobDisplayName(job.command),
      ...(job.startedAt && {
        durationMs: job.completedAt.getTime() - job.startedAt.getTime(),
      }),
    },
  };
}

/**
 * Transform Job record to all applicable events (started, completed, or failed)
 *
 * @param job - Job record with ticket relation
 * @param actor - Actor (usually AI-BOARD for workflow jobs)
 * @returns Array of job events (0-2 events)
 */
export function transformJobToEvents(
  job: JobWithTicket,
  actor: Actor
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  const startedEvent = transformJobToStartedEvent(job, actor);
  if (startedEvent) {
    events.push(startedEvent);
  }

  const completedEvent = transformJobToCompletedEvent(job, actor);
  if (completedEvent) {
    events.push(completedEvent);
  }

  const failedEvent = transformJobToFailedEvent(job, actor);
  if (failedEvent) {
    events.push(failedEvent);
  }

  return events;
}

// ============================================================================
// Merge and Sort (T006)
// ============================================================================

/**
 * Merge and sort activity events by timestamp (newest first)
 *
 * @param events - Array of activity events to merge
 * @returns Sorted array (newest first)
 */
export function mergeAndSortEvents(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => {
    const timestampDiff =
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    // Secondary sort by event ID for stable ordering
    if (timestampDiff === 0) {
      return a.id.localeCompare(b.id);
    }
    return timestampDiff;
  });
}

// ============================================================================
// Command Display Names (T007) - Re-exported from job-display-names.ts
// ============================================================================

// The getJobDisplayName function is already implemented in job-display-names.ts
// and is used by the transformation functions above.

/**
 * Extended command display names for activity feed
 * Includes additional commands that may appear in the activity feed
 */
export const ACTIVITY_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  // Rollback commands
  'rollback-reset': 'Rollback reset',
  'clean': 'Cleanup',
};

/**
 * Get display name for command, with fallback to job-display-names
 *
 * @param command - Job command string
 * @returns Human-readable display name
 */
export function getCommandDisplayName(command: string): string {
  // Check extended names first
  const extendedName = ACTIVITY_COMMAND_DISPLAY_NAMES[command];
  if (extendedName !== undefined) {
    return extendedName;
  }
  // Fall back to standard job display names
  return getJobDisplayName(command);
}
