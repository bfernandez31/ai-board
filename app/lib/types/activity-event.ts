import type { Stage } from '@prisma/client';

export type JobCommand =
  | 'specify'
  | 'plan'
  | 'implement'
  | 'quick-impl'
  | 'verify'
  | 'deploy-preview'
  | 'clean'
  | 'rollback-reset'
  | 'comment-specify'
  | 'comment-plan'
  | 'comment-build'
  | 'comment-verify';

export interface Actor {
  type: 'user' | 'system';
  id: string | null;
  name: string;
  image: string | null;
}

export interface TicketReference {
  id: number;
  ticketKey: string;
  title: string;
  exists: boolean;
  stage: Stage | null;
}

export type ActivityEventType =
  | 'ticket_created'
  | 'stage_changed'
  | 'comment_posted'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'pr_created'
  | 'preview_deployed';

interface BaseActivityEvent {
  id: string;
  timestamp: string;
  actor: Actor;
  ticket: TicketReference;
}

export interface TicketCreatedEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: { title: string };
}

export interface StageChangedEvent extends BaseActivityEvent {
  type: 'stage_changed';
  data: { fromStage: Stage; toStage: Stage };
}

export interface CommentPostedEvent extends BaseActivityEvent {
  type: 'comment_posted';
  data: { preview: string; commentId: number };
}

export interface JobStartedEvent extends BaseActivityEvent {
  type: 'job_started';
  data: { command: JobCommand; jobId: number };
}

export interface JobCompletedEvent extends BaseActivityEvent {
  type: 'job_completed';
  data: { command: JobCommand; jobId: number; durationMs: number | null };
}

export interface JobFailedEvent extends BaseActivityEvent {
  type: 'job_failed';
  data: { command: JobCommand; jobId: number };
}

export interface PRCreatedEvent extends BaseActivityEvent {
  type: 'pr_created';
  data: { jobId: number };
}

export interface PreviewDeployedEvent extends BaseActivityEvent {
  type: 'preview_deployed';
  data: { jobId: number; previewUrl: string | null };
}

export type ActivityEvent =
  | TicketCreatedEvent
  | StageChangedEvent
  | CommentPostedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | PRCreatedEvent
  | PreviewDeployedEvent;

export interface PaginationCursor {
  timestamp: string;
  id: string;
  eventType: string;
}

export interface PaginationResponse {
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number;
  cursorExpired: boolean;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  pagination: PaginationResponse;
  metadata: {
    projectId: number;
    rangeStart: string;
    rangeEnd: string;
    fetchedAt: string;
  };
}

export function isTicketCreatedEvent(event: ActivityEvent): event is TicketCreatedEvent {
  return event.type === 'ticket_created';
}

export function isStageChangedEvent(event: ActivityEvent): event is StageChangedEvent {
  return event.type === 'stage_changed';
}

export function isCommentPostedEvent(event: ActivityEvent): event is CommentPostedEvent {
  return event.type === 'comment_posted';
}

export function isJobStartedEvent(event: ActivityEvent): event is JobStartedEvent {
  return event.type === 'job_started';
}

export function isJobCompletedEvent(event: ActivityEvent): event is JobCompletedEvent {
  return event.type === 'job_completed';
}

export function isJobFailedEvent(event: ActivityEvent): event is JobFailedEvent {
  return event.type === 'job_failed';
}

export function isPRCreatedEvent(event: ActivityEvent): event is PRCreatedEvent {
  return event.type === 'pr_created';
}

export function isPreviewDeployedEvent(event: ActivityEvent): event is PreviewDeployedEvent {
  return event.type === 'preview_deployed';
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
