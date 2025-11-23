import type { JobStatus } from '@prisma/client';

/**
 * ContextualLabel Type
 *
 * User-friendly labels for RUNNING job statuses based on command context.
 * - WRITING: Specification and planning operations (specify, plan)
 * - CODING: Implementation operations (implement, quick-impl)
 * - TESTING: Test execution and verification operations (verify)
 * - ASSISTING: AI-BOARD assistance operations (comment-*)
 */
export type ContextualLabel = 'WRITING' | 'CODING' | 'TESTING' | 'ASSISTING';

/**
 * DisplayStatus Type
 *
 * Union type combining JobStatus enum values with ContextualLabel values.
 * Represents the final display value shown in the UI for job status indicators.
 */
export type DisplayStatus = JobStatus | ContextualLabel;

/**
 * getContextualLabel Function
 *
 * Transforms job status to contextual label based on command and status.
 * Only RUNNING status is transformed; other statuses pass through unchanged.
 *
 * @param command - Job command string (e.g., "specify", "implement", "verify", "comment-plan")
 * @param status - Current job status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
 * @returns DisplayStatus - Contextual label for RUNNING status, or original status otherwise
 *
 * Transformation Rules:
 * - specify, plan → WRITING (specification and planning work)
 * - implement, quick-impl → CODING (implementation work)
 * - verify → TESTING (test execution and verification)
 * - comment-* → ASSISTING (AI-BOARD assistance)
 * - Unknown commands → original status (defensive fallback)
 * - Non-RUNNING statuses → original status (no transformation)
 */
export function getContextualLabel(
  command: string,
  status: JobStatus
): DisplayStatus {
  // Only transform RUNNING status
  if (status !== 'RUNNING') {
    return status;
  }

  // Transform based on command
  if (command === 'specify' || command === 'plan') {
    return 'WRITING';
  }

  if (command === 'implement' || command === 'quick-impl') {
    return 'CODING';
  }

  // NEW: verify command shows "TESTING" for RUNNING status
  if (command === 'verify') {
    return 'TESTING';
  }

  // Iterate command (minor fixes during VERIFY) shows "TESTING"
  if (command === 'iterate') {
    return 'TESTING';
  }

  if (command.startsWith('comment-')) {
    return 'ASSISTING';
  }

  // Unknown commands keep original status
  return status;
}
