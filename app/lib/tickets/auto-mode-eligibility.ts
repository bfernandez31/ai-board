import type { Stage, WorkflowType } from '@prisma/client';

export interface AutoModeEligibilityInput {
  workflowType: WorkflowType;
  stage: Stage;
}

/**
 * Returns true iff the ticket is eligible for auto-mode:
 * - `workflowType === 'FULL'` AND
 * - `stage ∈ {INBOX, SPECIFY, PLAN}`
 *
 * Per FR-001/003/004.
 */
export function isAutoModeEligible(ticket: AutoModeEligibilityInput): boolean {
  if (ticket.workflowType !== 'FULL') return false;
  return (
    ticket.stage === 'INBOX' ||
    ticket.stage === 'SPECIFY' ||
    ticket.stage === 'PLAN'
  );
}
