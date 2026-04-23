import type { CommentWithUser } from '@/app/lib/types/comment';
import type { JobLogAvailability, JobLogSummary } from '@/app/lib/schemas/job-logs';
import type { JobStatus } from '@prisma/client';

export interface TimelineJobData {
  id: number;
  command: string;
  status: JobStatus;
  startedAt: Date | string;
  completedAt: Date | string | null;
  workflowRunId: bigint | string | null;
  logAvailability: JobLogAvailability | null;
  logSummary: JobLogSummary | null;
  logCapturedAt: string | null;
  logRetainedUntil: string | null;
  logPrunedAt: string | null;
}

interface BaseConversationEvent {
  type: 'comment' | 'job';
  timestamp: string;
}

export interface CommentEvent extends BaseConversationEvent {
  type: 'comment';
  timestamp: string;
  data: CommentWithUser;
}

export interface JobEvent extends BaseConversationEvent {
  type: 'job';
  timestamp: string;
  data: TimelineJobData;
  eventType: 'start' | 'complete';
}

export type ConversationEvent = CommentEvent | JobEvent;

export type JobEventType = 'start' | 'complete' | 'fail' | 'cancel';

export type TimelineItemType = 'comment' | 'job';

export function getJobEventType(status: JobStatus): JobEventType {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
      return 'start';
    case 'COMPLETED':
      return 'complete';
    case 'FAILED':
      return 'fail';
    case 'CANCELLED':
      return 'cancel';
  }
}

export function isCommentEvent(event: ConversationEvent): event is CommentEvent {
  return event.type === 'comment';
}

export function isJobEvent(event: ConversationEvent): event is JobEvent {
  return event.type === 'job';
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
