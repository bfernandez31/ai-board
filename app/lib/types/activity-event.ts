/**
 * Activity Event Types for Project Activity Feed
 * Feature: AIB-172 Project Activity Feed
 *
 * This module defines discriminated union types for the unified activity feed,
 * aggregating events from tickets, jobs, and comments into a chronological timeline.
 */

import { z } from 'zod';
import type { Stage } from '@prisma/client';

/**
 * Actor information for event attribution
 */
export interface Actor {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isSystem: boolean; // true for AI-BOARD system actor
}

/**
 * Reference to a ticket in an activity event
 */
export interface TicketReference {
  ticketKey: string;
  ticketId: string;
  isDeleted: boolean;
}

/**
 * Discriminated union of all activity event types
 */
export type ActivityEventType =
  | 'ticket_created'
  | 'ticket_stage_changed'
  | 'comment_posted'
  | 'job_started'
  | 'job_completed'
  | 'job_failed';

/**
 * Base interface for all activity events
 */
interface BaseActivityEvent {
  id: string; // Unique event identifier (derived)
  type: ActivityEventType;
  timestamp: string; // ISO 8601
  actor: Actor;
  ticket: TicketReference;
  projectId: string;
}

/**
 * Ticket created event
 */
export interface TicketCreatedEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: {
    title: string;
  };
}

/**
 * Ticket stage changed event
 */
export interface TicketStageChangedEvent extends BaseActivityEvent {
  type: 'ticket_stage_changed';
  data: {
    fromStage?: Stage; // May not be available (derived)
    toStage: Stage;
  };
}

/**
 * Comment posted event
 */
export interface CommentPostedEvent extends BaseActivityEvent {
  type: 'comment_posted';
  data: {
    contentPreview: string; // First 100 chars
    isAiBoardMention: boolean; // Contains @ai-board
  };
}

/**
 * Job started event
 */
export interface JobStartedEvent extends BaseActivityEvent {
  type: 'job_started';
  data: {
    command: string;
    displayName: string; // Human-readable command name
  };
}

/**
 * Job completed event
 */
export interface JobCompletedEvent extends BaseActivityEvent {
  type: 'job_completed';
  data: {
    command: string;
    displayName: string;
    durationMs?: number;
  };
}

/**
 * Job failed event
 */
export interface JobFailedEvent extends BaseActivityEvent {
  type: 'job_failed';
  data: {
    command: string;
    displayName: string;
    durationMs?: number;
  };
}

/**
 * Discriminated union of all activity events
 */
export type ActivityEvent =
  | TicketCreatedEvent
  | TicketStageChangedEvent
  | CommentPostedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent;

/**
 * Pagination information for activity feed response
 */
export interface ActivityPagination {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * API response for activity feed endpoint
 */
export interface ActivityFeedResponse {
  events: ActivityEvent[];
  pagination: ActivityPagination;
  actors: Record<string, Actor>; // Lookup map by actor ID
}

/**
 * Zod schema for validating API query parameters
 */
export const activityFeedParamsSchema = z.object({
  offset: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.coerce.number().int().min(0).default(0)
  ),
  limit: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.coerce.number().int().min(1).max(100).default(50)
  ),
  since: z.preprocess(
    (val) => (val === null || val === '' ? undefined : val),
    z.string().datetime().optional()
  ),
});

/**
 * Inferred type from Zod schema
 */
export type ActivityFeedParams = z.infer<typeof activityFeedParamsSchema>;

// Type guards for discriminated union

/**
 * Type guard for ticket created events
 */
export function isTicketCreatedEvent(
  event: ActivityEvent
): event is TicketCreatedEvent {
  return event.type === 'ticket_created';
}

/**
 * Type guard for ticket stage changed events
 */
export function isTicketStageChangedEvent(
  event: ActivityEvent
): event is TicketStageChangedEvent {
  return event.type === 'ticket_stage_changed';
}

/**
 * Type guard for comment posted events
 */
export function isCommentPostedEvent(
  event: ActivityEvent
): event is CommentPostedEvent {
  return event.type === 'comment_posted';
}

/**
 * Type guard for job started events
 */
export function isJobStartedEvent(
  event: ActivityEvent
): event is JobStartedEvent {
  return event.type === 'job_started';
}

/**
 * Type guard for job completed events
 */
export function isJobCompletedEvent(
  event: ActivityEvent
): event is JobCompletedEvent {
  return event.type === 'job_completed';
}

/**
 * Type guard for job failed events
 */
export function isJobFailedEvent(
  event: ActivityEvent
): event is JobFailedEvent {
  return event.type === 'job_failed';
}

/**
 * Type guard for any job event
 */
export function isJobEvent(
  event: ActivityEvent
): event is JobStartedEvent | JobCompletedEvent | JobFailedEvent {
  return (
    event.type === 'job_started' ||
    event.type === 'job_completed' ||
    event.type === 'job_failed'
  );
}

/**
 * Helper function for exhaustive checking in switch statements
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled activity event type: ${JSON.stringify(value)}`);
}
