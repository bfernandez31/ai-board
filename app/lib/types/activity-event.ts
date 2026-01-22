/**
 * Activity Event Types for Project-Level Activity Feed
 * Feature: AIB-181-copy-of-project
 *
 * This module defines discriminated union types for the unified activity feed,
 * aggregating jobs, comments, ticket creation, stage changes, PR creation, and preview deployments.
 */

import type { JobStatus, WorkflowType, Stage } from '@prisma/client';

/**
 * Event type discriminator for all activity events
 */
export type ActivityEventType =
  | 'job'
  | 'comment'
  | 'ticket_created'
  | 'stage_changed'
  | 'pr_created'
  | 'preview_deployed';

/**
 * Actor represents who/what caused an event
 */
export interface Actor {
  type: 'user' | 'system';
  id: string | null;
  name: string;
  email: string | null;
  image: string | null;
}

/**
 * System actor for automated actions (AI-BOARD)
 */
export const SYSTEM_ACTOR: Actor = {
  type: 'system',
  id: null,
  name: 'AI-BOARD',
  email: null,
  image: null,
};

/**
 * Base interface for all activity events
 */
interface BaseActivityEvent {
  type: ActivityEventType;
  timestamp: string; // ISO 8601
  ticketKey: string;
  ticketTitle: string;
  ticketId: number;
  ticketDeleted: boolean;
  actor: Actor;
}

/**
 * Job event data payload
 */
export interface JobEventData {
  eventType: 'start' | 'complete';
  jobId: number;
  command: string;
  status: JobStatus;
  displayName: string;
}

/**
 * Comment event data payload
 */
export interface CommentEventData {
  commentId: number;
  content: string; // Truncated to ~100 chars
}

/**
 * Ticket created event data payload
 */
export interface TicketCreatedEventData {
  workflowType: WorkflowType;
}

/**
 * Stage changed event data payload
 */
export interface StageChangedEventData {
  fromStage: Stage;
  toStage: Stage;
}

/**
 * PR created event data payload
 */
export interface PRCreatedEventData {
  prUrl: string | null;
}

/**
 * Preview deployed event data payload
 */
export interface PreviewDeployedEventData {
  previewUrl: string;
}

/**
 * Job activity event - represents job lifecycle (start/complete)
 */
export interface JobActivityEvent extends BaseActivityEvent {
  type: 'job';
  data: JobEventData;
}

/**
 * Comment activity event - represents user comment on ticket
 */
export interface CommentActivityEvent extends BaseActivityEvent {
  type: 'comment';
  data: CommentEventData;
}

/**
 * Ticket created activity event - represents new ticket creation
 */
export interface TicketCreatedActivityEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: TicketCreatedEventData;
}

/**
 * Stage changed activity event - represents ticket stage transition
 */
export interface StageChangedActivityEvent extends BaseActivityEvent {
  type: 'stage_changed';
  data: StageChangedEventData;
}

/**
 * PR created activity event - represents pull request creation
 */
export interface PRCreatedActivityEvent extends BaseActivityEvent {
  type: 'pr_created';
  data: PRCreatedEventData;
}

/**
 * Preview deployed activity event - represents Vercel preview deployment
 */
export interface PreviewDeployedActivityEvent extends BaseActivityEvent {
  type: 'preview_deployed';
  data: PreviewDeployedEventData;
}

/**
 * Union type for all activity events
 */
export type ActivityEvent =
  | JobActivityEvent
  | CommentActivityEvent
  | TicketCreatedActivityEvent
  | StageChangedActivityEvent
  | PRCreatedActivityEvent
  | PreviewDeployedActivityEvent;

/**
 * API response type for activity feed endpoint
 */
export interface ActivityFeedResponse {
  events: ActivityEvent[];
  hasMore: boolean;
  offset: number;
}

/**
 * Type guard to check if event is a job event
 */
export function isJobActivityEvent(event: ActivityEvent): event is JobActivityEvent {
  return event.type === 'job';
}

/**
 * Type guard to check if event is a comment event
 */
export function isCommentActivityEvent(event: ActivityEvent): event is CommentActivityEvent {
  return event.type === 'comment';
}

/**
 * Type guard to check if event is a ticket created event
 */
export function isTicketCreatedActivityEvent(event: ActivityEvent): event is TicketCreatedActivityEvent {
  return event.type === 'ticket_created';
}

/**
 * Type guard to check if event is a stage changed event
 */
export function isStageChangedActivityEvent(event: ActivityEvent): event is StageChangedActivityEvent {
  return event.type === 'stage_changed';
}

/**
 * Type guard to check if event is a PR created event
 */
export function isPRCreatedActivityEvent(event: ActivityEvent): event is PRCreatedActivityEvent {
  return event.type === 'pr_created';
}

/**
 * Type guard to check if event is a preview deployed event
 */
export function isPreviewDeployedActivityEvent(event: ActivityEvent): event is PreviewDeployedActivityEvent {
  return event.type === 'preview_deployed';
}
