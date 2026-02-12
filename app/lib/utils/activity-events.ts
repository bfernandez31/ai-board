import type { Job, Comment, Ticket, User, Stage } from '@prisma/client';
import type {
  ActivityEvent,
  Actor,
  TicketReference,
  JobCommand,
  PaginationCursor,
} from '@/app/lib/types/activity-event';

export interface JobWithTicket extends Job {
  ticket: Ticket;
}

export interface CommentWithUser extends Comment {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'> | null;
}

export const COMMAND_STAGE_TRANSITIONS: Partial<
  Record<JobCommand, { fromStage: Stage; toStage: Stage }>
> = {
  specify: { fromStage: 'INBOX', toStage: 'SPECIFY' },
  plan: { fromStage: 'SPECIFY', toStage: 'PLAN' },
  implement: { fromStage: 'PLAN', toStage: 'BUILD' },
  'quick-impl': { fromStage: 'INBOX', toStage: 'BUILD' },
  verify: { fromStage: 'BUILD', toStage: 'VERIFY' },
};

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

export function createSystemActor(): Actor {
  return {
    type: 'system',
    id: 'ai-board',
    name: 'AI-BOARD',
    image: null,
  };
}

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

export function getStageTransition(
  command: string
): { fromStage: Stage; toStage: Stage } | null {
  return COMMAND_STAGE_TRANSITIONS[command as JobCommand] || null;
}

export function deriveJobEvents(job: JobWithTicket): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const actor = createSystemActor();
  const ticket = createTicketReference(job.ticket);

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
  }

  return events;
}

export function deriveCommentEvent(
  comment: CommentWithUser,
  ticket: Ticket
): ActivityEvent {
  const actor = createUserActor(comment.user);
  const ticketRef = createTicketReference(ticket);

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
    data: { preview, commentId: comment.id },
  };
}

export function deriveTicketCreatedEvent(ticket: Ticket): ActivityEvent {
  const actor = createSystemActor();
  const ticketRef = createTicketReference(ticket);

  return {
    type: 'ticket_created',
    id: `ticket_created_${ticket.id}`,
    timestamp: ticket.createdAt.toISOString(),
    actor,
    ticket: ticketRef,
    data: { title: ticket.title },
  };
}

export function mergeActivityEvents(
  events: ActivityEvent[]
): ActivityEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

export function decodeCursor(encoded: string): PaginationCursor | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);

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
    const cursorIndex = events.findIndex(
      (e) =>
        e.id === cursor.id &&
        e.timestamp === cursor.timestamp &&
        e.type === cursor.eventType
    );

    if (cursorIndex === -1) {
      cursorExpired = true;
      startIndex = 0;
    } else {
      startIndex = cursorIndex + 1;
    }
  }

  const paginatedEvents = events.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < events.length;

  const lastEvent = paginatedEvents[paginatedEvents.length - 1];
  const nextCursor = hasMore && lastEvent
    ? encodeCursor({
        timestamp: lastEvent.timestamp,
        id: lastEvent.id,
        eventType: lastEvent.type,
      })
    : null;

  return { events: paginatedEvents, hasMore, nextCursor, cursorExpired };
}
