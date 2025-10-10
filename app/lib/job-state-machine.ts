/**
 * Job State Machine
 *
 * Defines state transition rules for Job lifecycle management.
 * Implements validation logic for workflow completion scenarios.
 *
 * Valid transitions:
 * - PENDING → RUNNING
 * - RUNNING → COMPLETED | FAILED | CANCELLED
 * - Terminal states (COMPLETED, FAILED, CANCELLED) can only transition to themselves (idempotent)
 *
 * @see specs/019-update-job-on/data-model.md for state machine documentation
 */

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Defines all valid state transitions for Job lifecycle.
 * Terminal states (COMPLETED, FAILED, CANCELLED) can only transition to themselves.
 */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['PENDING', 'RUNNING'],
  RUNNING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: ['COMPLETED'],  // Terminal - only idempotent transitions
  FAILED: ['FAILED'],        // Terminal - only idempotent transitions
  CANCELLED: ['CANCELLED']   // Terminal - only idempotent transitions
};

/**
 * Validates whether a state transition is allowed.
 *
 * @param from Current job status
 * @param to Requested new status
 * @returns true if transition is valid, false otherwise
 *
 * @example
 * canTransition('RUNNING', 'COMPLETED') // true
 * canTransition('COMPLETED', 'FAILED')  // false
 * canTransition('COMPLETED', 'COMPLETED') // true (idempotent)
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

/**
 * Checks if a status is terminal (no further transitions possible).
 * Terminal states can only transition to themselves (idempotent).
 *
 * @param status Job status to check
 * @returns true if status is terminal (COMPLETED, FAILED, or CANCELLED)
 *
 * @example
 * isTerminalStatus('COMPLETED') // true
 * isTerminalStatus('RUNNING')   // false
 */
export function isTerminalStatus(status: JobStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[status];
  // Terminal states only allow self-transitions (length 1 with only itself)
  return allowedTransitions.length === 1 && allowedTransitions[0] === status;
}

/**
 * Custom error for invalid state transitions.
 * Thrown when attempting a transition that violates state machine rules.
 *
 * @example
 * throw new InvalidTransitionError('COMPLETED', 'FAILED')
 * // Error: "Invalid transition from COMPLETED to FAILED"
 */
export class InvalidTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
