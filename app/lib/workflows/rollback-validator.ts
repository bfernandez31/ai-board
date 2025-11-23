import { Stage, JobStatus, WorkflowType } from '@prisma/client';

export type RollbackValidation = {
  allowed: boolean;
  reason?: string;
};

export type Job = {
  id: number;
  status: JobStatus;
  command: string;
};

/**
 * Validates whether a ticket can be rolled back from BUILD to INBOX stage.
 *
 * Rollback is allowed ONLY for quick-impl tickets when:
 * 1. Current stage is BUILD and target stage is INBOX
 * 2. Ticket workflowType is QUICK (quick-impl workflow)
 * 3. A workflow job exists for the ticket
 * 4. The most recent workflow job has status FAILED or CANCELLED
 *
 * @param currentStage - The current stage of the ticket
 * @param targetStage - The target stage for the transition
 * @param workflowType - The ticket's workflow type (QUICK or FULL)
 * @param mostRecentWorkflowJob - The most recent workflow job (excluding AI-BOARD comment jobs)
 * @returns Validation result with allowed flag and optional error reason
 */
export function canRollbackToInbox(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // Rule 1: Only BUILD → INBOX transitions
  if (currentStage !== 'BUILD' || targetStage !== 'INBOX') {
    return {
      allowed: false,
      reason: 'Rollback only available from BUILD to INBOX stage',
    };
  }

  // Rule 2: Only quick-impl workflows can be rolled back
  if (workflowType !== 'QUICK') {
    return {
      allowed: false,
      reason: 'Rollback only available for quick-impl workflows. Normal workflows cannot be rolled back.',
    };
  }

  // Rule 3: Must have a workflow job
  if (!mostRecentWorkflowJob) {
    return {
      allowed: false,
      reason: 'No workflow job found for this ticket',
    };
  }

  // Rule 4: Job must be FAILED or CANCELLED
  const allowedStatuses: JobStatus[] = ['FAILED', 'CANCELLED'];
  if (!allowedStatuses.includes(mostRecentWorkflowJob.status)) {
    if (mostRecentWorkflowJob.status === 'RUNNING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is still running. Wait for completion or cancel the job.',
      };
    }
    if (mostRecentWorkflowJob.status === 'COMPLETED') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs.',
      };
    }
    if (mostRecentWorkflowJob.status === 'PENDING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is pending. Wait for completion or cancel the job.',
      };
    }
    return {
      allowed: false,
      reason: 'Cannot rollback: invalid job status',
    };
  }

  return { allowed: true };
}

/**
 * Validates whether a ticket can be rolled back from VERIFY to PLAN stage.
 *
 * Rollback is allowed ONLY for FULL workflow tickets when:
 * 1. Current stage is VERIFY and target stage is PLAN
 * 2. Ticket workflowType is FULL (not QUICK or CLEAN)
 * 3. A workflow job exists for the ticket
 * 4. The most recent workflow job has status COMPLETED, FAILED, or CANCELLED (not RUNNING or PENDING)
 *
 * @param currentStage - The current stage of the ticket
 * @param targetStage - The target stage for the transition
 * @param workflowType - The ticket's workflow type (QUICK, FULL, or CLEAN)
 * @param mostRecentWorkflowJob - The most recent workflow job (excluding AI-BOARD comment jobs)
 * @returns Validation result with allowed flag and optional error reason
 */
export function canRollbackToPlan(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // Rule 1: Only VERIFY → PLAN transitions
  if (currentStage !== 'VERIFY' || targetStage !== 'PLAN') {
    return {
      allowed: false,
      reason: 'Rollback only available from VERIFY to PLAN stage',
    };
  }

  // Rule 2: Only FULL workflows can be rolled back to PLAN
  if (workflowType === 'QUICK') {
    return {
      allowed: false,
      reason: 'Rollback only available for FULL workflows. QUICK workflows skip PLAN stage.',
    };
  }
  if (workflowType === 'CLEAN') {
    return {
      allowed: false,
      reason: 'Rollback only available for FULL workflows. CLEAN workflows have different stage progression.',
    };
  }

  // Rule 3: Must have a workflow job
  if (!mostRecentWorkflowJob) {
    return {
      allowed: false,
      reason: 'No workflow job found for this ticket',
    };
  }

  // Rule 4: Job must be COMPLETED, FAILED, or CANCELLED (not RUNNING or PENDING)
  const allowedStatuses: JobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (!allowedStatuses.includes(mostRecentWorkflowJob.status)) {
    if (mostRecentWorkflowJob.status === 'RUNNING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is still running. Wait for completion or cancel the job.',
      };
    }
    if (mostRecentWorkflowJob.status === 'PENDING') {
      return {
        allowed: false,
        reason: 'Cannot rollback: workflow is pending. Wait for completion or cancel the job.',
      };
    }
    return {
      allowed: false,
      reason: 'Cannot rollback: invalid job status',
    };
  }

  return { allowed: true };
}
