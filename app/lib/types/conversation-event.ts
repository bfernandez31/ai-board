/**
 * Conversation Event Types for GitHub-Style Ticket Conversations
 * Feature: 065-915-conversations-je
 *
 * This module defines discriminated union types for unified timeline rendering,
 * merging user comments and automated job lifecycle events.
 */

import type { CommentWithUser } from '@/app/lib/types/comment';
import type { Job, JobStatus } from '@prisma/client';

/**
 * Base event interface with common discriminator
 */
interface BaseConversationEvent {
  type: 'comment' | 'job';
  timestamp: string; // ISO 8601 for consistent sorting
}

/**
 * Comment event - represents user comment on ticket
 */
export interface CommentEvent extends BaseConversationEvent {
  type: 'comment';
  timestamp: string; // Same as comment.createdAt
  data: CommentWithUser;
}

/**
 * Job event - represents automated workflow or AI-BOARD job execution
 *
 * Job lifecycle:
 * - PENDING/RUNNING → Job start event (shows "started" message)
 * - COMPLETED → Job completion event (shows "completed" message)
 * - FAILED → Job failure event (shows "failed" message)
 * - CANCELLED → Job cancellation event (shows "cancelled" message)
 */
export interface JobEvent extends BaseConversationEvent {
  type: 'job';
  timestamp: string; // job.startedAt for start event, job.completedAt for completion event
  data: Job;
  eventType: 'start' | 'complete'; // Distinguishes start vs completion events
}

/**
 * Union type for all conversation events
 */
export type ConversationEvent = CommentEvent | JobEvent;

/**
 * Job event type for visual styling and icon selection
 */
export type JobEventType =
  | 'start'      // Job started (PENDING/RUNNING status)
  | 'complete'   // Job completed successfully (COMPLETED status)
  | 'fail'       // Job failed (FAILED status)
  | 'cancel';    // Job cancelled (CANCELLED status)

/**
 * Timeline item type for discriminating between event types
 */
export type TimelineItemType = 'comment' | 'job';

/**
 * Determine job event type from job status
 * Used for icon selection and message generation
 */
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

/**
 * Type guard to check if event is a comment event
 */
export function isCommentEvent(event: ConversationEvent): event is CommentEvent {
  return event.type === 'comment';
}

/**
 * Type guard to check if event is a job event
 */
export function isJobEvent(event: ConversationEvent): event is JobEvent {
  return event.type === 'job';
}

/**
 * Helper function for exhaustive checking in switch statements
 * Ensures compile-time safety when handling discriminated unions
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
