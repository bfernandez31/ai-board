/**
 * Activity Event Types for Project Activity Feed
 * Feature: AIB-177-project-activity-feed
 *
 * This module defines discriminated union types for unified activity timeline,
 * aggregating events from jobs, comments, and tickets tables.
 */

import type { Stage } from '@prisma/client';

/**
 * Job command types that can trigger stage transitions
 */
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

/**
 * Actor types for event attribution
 */
export interface Actor {
  type: 'user' | 'system';
  id: string | null; // User ID or null for system
  name: string; // Display name or "AI-BOARD" or "[Deleted user]"
  image: string | null; // Avatar URL or null
}

/**
 * Lightweight reference to a ticket for navigation
 */
export interface TicketReference {
  id: number;
  ticketKey: string; // e.g., "AIB-123"
  title: string;
  exists: boolean; // false if ticket was deleted
  stage: Stage | null; // null if ticket deleted
}

/**
 * Event type discriminants for ActivityEvent union
 */
export type ActivityEventType =
  | 'ticket_created'
  | 'stage_changed'
  | 'comment_posted'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'pr_created'
  | 'preview_deployed';

/**
 * Base fields shared by all events
 */
interface BaseActivityEvent {
  id: string; // Composite: {type}_{sourceId}_{timestamp}
  timestamp: string; // ISO 8601 datetime
  actor: Actor; // Who performed the action
  ticket: TicketReference; // Related ticket
}

/**
 * Event: Ticket was created in the project
 */
export interface TicketCreatedEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: {
    title: string;
  };
}

/**
 * Event: Ticket moved to a different stage
 */
export interface StageChangedEvent extends BaseActivityEvent {
  type: 'stage_changed';
  data: {
    fromStage: Stage;
    toStage: Stage;
  };
}

/**
 * Event: Comment was posted on a ticket
 */
export interface CommentPostedEvent extends BaseActivityEvent {
  type: 'comment_posted';
  data: {
    preview: string; // First 100 chars of comment
    commentId: number;
  };
}

/**
 * Event: Job execution started
 */
export interface JobStartedEvent extends BaseActivityEvent {
  type: 'job_started';
  data: {
    command: JobCommand;
    jobId: number;
  };
}

/**
 * Event: Job completed successfully
 */
export interface JobCompletedEvent extends BaseActivityEvent {
  type: 'job_completed';
  data: {
    command: JobCommand;
    jobId: number;
    durationMs: number | null;
  };
}

/**
 * Event: Job failed to complete
 */
export interface JobFailedEvent extends BaseActivityEvent {
  type: 'job_failed';
  data: {
    command: JobCommand;
    jobId: number;
  };
}

/**
 * Event: Pull request was created (verify command completed)
 */
export interface PRCreatedEvent extends BaseActivityEvent {
  type: 'pr_created';
  data: {
    jobId: number;
  };
}

/**
 * Event: Preview deployment completed
 */
export interface PreviewDeployedEvent extends BaseActivityEvent {
  type: 'preview_deployed';
  data: {
    jobId: number;
    previewUrl: string | null;
  };
}

/**
 * Union type for all activity events
 */
export type ActivityEvent =
  | TicketCreatedEvent
  | StageChangedEvent
  | CommentPostedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | PRCreatedEvent
  | PreviewDeployedEvent;

/**
 * Cursor for stable pagination through the activity feed
 */
export interface PaginationCursor {
  timestamp: string; // ISO 8601 datetime
  id: string; // Event ID
  eventType: string; // Event type for disambiguation
}

/**
 * Pagination response metadata
 */
export interface PaginationResponse {
  hasMore: boolean;
  nextCursor: string | null; // base64 encoded PaginationCursor
  totalCount: number; // Total events in 30-day window
  cursorExpired: boolean; // True if cursor event was not found
}

/**
 * API response structure for the activity feed endpoint
 */
export interface ActivityFeedResponse {
  events: ActivityEvent[];
  pagination: PaginationResponse;
  metadata: {
    projectId: number;
    rangeStart: string; // 30 days ago, ISO 8601
    rangeEnd: string; // Now, ISO 8601
    fetchedAt: string; // Query timestamp, ISO 8601
  };
}

/**
 * Type guard to check if event is a ticket_created event
 */
export function isTicketCreatedEvent(event: ActivityEvent): event is TicketCreatedEvent {
  return event.type === 'ticket_created';
}

/**
 * Type guard to check if event is a stage_changed event
 */
export function isStageChangedEvent(event: ActivityEvent): event is StageChangedEvent {
  return event.type === 'stage_changed';
}

/**
 * Type guard to check if event is a comment_posted event
 */
export function isCommentPostedEvent(event: ActivityEvent): event is CommentPostedEvent {
  return event.type === 'comment_posted';
}

/**
 * Type guard to check if event is a job_started event
 */
export function isJobStartedEvent(event: ActivityEvent): event is JobStartedEvent {
  return event.type === 'job_started';
}

/**
 * Type guard to check if event is a job_completed event
 */
export function isJobCompletedEvent(event: ActivityEvent): event is JobCompletedEvent {
  return event.type === 'job_completed';
}

/**
 * Type guard to check if event is a job_failed event
 */
export function isJobFailedEvent(event: ActivityEvent): event is JobFailedEvent {
  return event.type === 'job_failed';
}

/**
 * Type guard to check if event is a pr_created event
 */
export function isPRCreatedEvent(event: ActivityEvent): event is PRCreatedEvent {
  return event.type === 'pr_created';
}

/**
 * Type guard to check if event is a preview_deployed event
 */
export function isPreviewDeployedEvent(event: ActivityEvent): event is PreviewDeployedEvent {
  return event.type === 'preview_deployed';
}

/**
 * Helper function for exhaustive checking in switch statements
 * Ensures compile-time safety when handling discriminated unions
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
