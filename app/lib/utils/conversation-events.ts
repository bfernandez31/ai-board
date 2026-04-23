import type { CommentWithUser } from '@/app/lib/types/comment';
import type { JobStatus } from '@prisma/client';
import type {
  CommentEvent,
  JobEvent,
  ConversationEvent,
  TimelineJobData,
} from '@/app/lib/types/conversation-event';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

export function createCommentEvent(comment: CommentWithUser): CommentEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt,
    data: comment,
  };
}

export function createJobEvents(job: TimelineJobData): JobEvent[] {
  const events: JobEvent[] = [];

  events.push({
    type: 'job',
    timestamp: new Date(job.startedAt).toISOString(),
    data: job,
    eventType: 'start',
  });

  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: new Date(job.completedAt).toISOString(),
      data: job,
      eventType: 'complete',
    });
  }

  return events;
}

export function mergeConversationEvents(
  comments: CommentWithUser[],
  jobs: TimelineJobData[]
): ConversationEvent[] {
  const commentEvents = comments.map(createCommentEvent);
  const jobEvents = jobs.flatMap(createJobEvents);

  return [...commentEvents, ...jobEvents].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getJobEventMessage(
  command: string,
  eventType: 'start' | 'complete',
  status: JobStatus
): string {
  const displayName = getJobDisplayName(command);
  const quickIndicator = command === 'quick-impl' ? ' ⚡' : '';

  if (eventType === 'start') {
    return `${displayName}${quickIndicator} started`;
  }

  switch (status) {
    case 'COMPLETED':
      return `${displayName}${quickIndicator} completed`;
    case 'FAILED':
      return `${displayName}${quickIndicator} failed`;
    case 'CANCELLED':
      return `${displayName}${quickIndicator} cancelled`;
    default:
      return `${displayName}${quickIndicator} updated`;
  }
}
