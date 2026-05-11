import type { InsightsRunStatus } from '@prisma/client';

/**
 * Valid InsightsReport status transitions (AIB-791).
 *
 * - RUNNING → COMPLETED | FAILED
 * - Terminal states (COMPLETED, FAILED) may only transition to themselves
 *   (idempotent), enforcing VR-2 / VR-3.
 */
const VALID_TRANSITIONS: Record<InsightsRunStatus, InsightsRunStatus[]> = {
  RUNNING: ['RUNNING', 'COMPLETED', 'FAILED'],
  COMPLETED: ['COMPLETED'],
  FAILED: ['FAILED'],
};

export function canTransition(
  from: InsightsRunStatus,
  to: InsightsRunStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: InsightsRunStatus): boolean {
  const allowed = VALID_TRANSITIONS[status];
  return allowed.length === 1 && allowed[0] === status;
}
