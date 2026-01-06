/**
 * Stage Validation Utilities
 *
 * Provides stage enum and validation functions for sequential workflow transitions.
 * Tickets can only move to the immediately next stage (no skipping, no backwards).
 */

export enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
  CLOSED = 'CLOSED',
}

/**
 * Ordered array of stages representing the sequential workflow.
 * INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
 */
const STAGE_ORDER: Stage[] = [
  Stage.INBOX,
  Stage.SPECIFY,
  Stage.PLAN,
  Stage.BUILD,
  Stage.VERIFY,
  Stage.SHIP,
];

/**
 * Get the next valid stage in the workflow sequence.
 *
 * @param currentStage - The current stage
 * @returns The next stage in sequence, or null if already at final stage or invalid stage
 *
 * @example
 * getNextStage(Stage.INBOX) // Returns Stage.SPECIFY
 * getNextStage(Stage.SPECIFY) // Returns Stage.PLAN
 * getNextStage(Stage.SHIP)  // Returns null (terminal stage)
 */
export function getNextStage(currentStage: Stage): Stage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  // Invalid stage or already at final stage
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  return nextStage ?? null;
}

/**
 * Validate if a stage transition is allowed.
 * Sequential transitions to the immediately next stage are valid.
 * Special cases:
 * - Quick-impl allows INBOX → BUILD (skipping SPECIFY and PLAN)
 * - Rollback allows BUILD → INBOX (only for QUICK workflowType)
 * - Rollback allows VERIFY → PLAN (only for FULL workflowType)
 *
 * @param fromStage - The current stage
 * @param toStage - The target stage
 * @param workflowType - Optional workflow type ('QUICK' or 'FULL')
 * @returns true if transition is valid (sequential, quick-impl, or rollback), false otherwise
 *
 * @example
 * isValidTransition(Stage.INBOX, Stage.SPECIFY)  // true (valid: next stage)
 * isValidTransition(Stage.INBOX, Stage.BUILD)    // true (valid: quick-impl special case)
 * isValidTransition(Stage.BUILD, Stage.INBOX, 'QUICK')  // true (valid: rollback for quick-impl)
 * isValidTransition(Stage.BUILD, Stage.INBOX, 'FULL')   // false (rollback not allowed for normal workflow)
 * isValidTransition(Stage.VERIFY, Stage.PLAN, 'FULL')   // true (valid: rollback for FULL workflow)
 * isValidTransition(Stage.VERIFY, Stage.PLAN, 'QUICK')  // false (rollback not allowed for quick-impl)
 * isValidTransition(Stage.INBOX, Stage.PLAN)    // false (invalid: skipping SPECIFY)
 * isValidTransition(Stage.SPECIFY, Stage.BUILD) // false (invalid: skipping PLAN)
 * isValidTransition(Stage.BUILD, Stage.PLAN)    // false (invalid: backwards)
 * isValidTransition(Stage.SHIP, Stage.INBOX)    // false (invalid: backwards from terminal)
 */
export function isValidTransition(
  fromStage: Stage,
  toStage: Stage,
  workflowType?: 'QUICK' | 'FULL' | 'CLEAN'
): boolean {
  // CLOSED is terminal - no transitions allowed from CLOSED
  if (fromStage === Stage.CLOSED) {
    return false;
  }

  // Special case: Close transition allows VERIFY → CLOSED
  if (fromStage === Stage.VERIFY && toStage === Stage.CLOSED) {
    return true;
  }

  // Special case: Quick-impl allows INBOX → BUILD
  if (fromStage === Stage.INBOX && toStage === Stage.BUILD) {
    return true;
  }

  // Special case: Rollback allows BUILD → INBOX (only for QUICK workflow)
  if (fromStage === Stage.BUILD && toStage === Stage.INBOX) {
    return workflowType === 'QUICK';
  }

  // Special case: Rollback allows VERIFY → PLAN (only for FULL workflow)
  if (fromStage === Stage.VERIFY && toStage === Stage.PLAN) {
    return workflowType === 'FULL';
  }

  // Normal sequential validation
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}

/**
 * Get all valid stage values as an array.
 * Useful for validation and dropdown generation.
 *
 * @returns Array of all stage values in order
 */
export function getAllStages(): Stage[] {
  return [...STAGE_ORDER];
}

/**
 * Check if a stage is a terminal stage (no further transitions possible).
 *
 * @param stage - The stage to check
 * @returns true if stage is SHIP or CLOSED (terminal), false otherwise
 */
export function isTerminalStage(stage: Stage): boolean {
  return stage === Stage.SHIP || stage === Stage.CLOSED;
}

/**
 * Check if a transition is a close transition (VERIFY → CLOSED).
 *
 * @param fromStage - The source stage
 * @param toStage - The target stage
 * @returns true if this is a close transition
 */
export function isCloseTransition(fromStage: Stage, toStage: Stage): boolean {
  return fromStage === Stage.VERIFY && toStage === Stage.CLOSED;
}

/**
 * Validation result for close ticket operation.
 */
export interface CloseValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a ticket can be closed.
 * Only tickets in VERIFY stage can be closed.
 * Closure is blocked when:
 * - There are active jobs (PENDING or RUNNING status)
 * - A cleanup lock is active on the project
 *
 * @param currentStage - The current stage of the ticket
 * @param mostRecentJob - The most recent job for the ticket (if any)
 * @returns Validation result with allowed flag and optional reason
 */
export function canCloseTicket(
  currentStage: Stage,
  mostRecentJob: { status: string } | null
): CloseValidationResult {
  // Only VERIFY can transition to CLOSED
  if (currentStage !== Stage.VERIFY) {
    return { allowed: false, reason: 'Only tickets in VERIFY stage can be closed' };
  }

  // Block if job is active
  if (mostRecentJob && ['PENDING', 'RUNNING'].includes(mostRecentJob.status)) {
    return { allowed: false, reason: 'Cannot close: workflow is still running' };
  }

  return { allowed: true };
}
