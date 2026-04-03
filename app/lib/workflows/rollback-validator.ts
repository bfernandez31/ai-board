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

function validateJobStatus(
  job: Job | null,
  allowedStatuses: JobStatus[]
): RollbackValidation | null {
  if (!job) {
    return { allowed: false, reason: 'No workflow job found for this ticket' };
  }

  if (allowedStatuses.includes(job.status)) return null;

  switch (job.status) {
    case 'RUNNING':
      return { allowed: false, reason: 'Cannot rollback: workflow is still running. Wait for completion or cancel the job.' };
    case 'PENDING':
      return { allowed: false, reason: 'Cannot rollback: workflow is pending. Wait for completion or cancel the job.' };
    case 'COMPLETED':
      return { allowed: false, reason: 'Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs.' };
    default:
      return { allowed: false, reason: 'Cannot rollback: invalid job status' };
  }
}

export function canRollbackToInbox(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // BUILD → INBOX (QUICK only, existing)
  if (currentStage === 'BUILD' && targetStage === 'INBOX' && workflowType === 'QUICK') {
    const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['FAILED', 'CANCELLED']);
    if (statusCheck) return statusCheck;
    return { allowed: true };
  }

  // SPECIFY → INBOX (any workflow)
  if (currentStage === 'SPECIFY' && targetStage === 'INBOX') {
    const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['FAILED', 'CANCELLED']);
    if (statusCheck) return statusCheck;
    return { allowed: true };
  }

  if (currentStage === 'BUILD' && targetStage === 'INBOX' && workflowType !== 'QUICK') {
    return { allowed: false, reason: 'Rollback only available for quick-impl workflows. Normal workflows cannot be rolled back.' };
  }

  return { allowed: false, reason: 'Invalid rollback transition to INBOX' };
}

export function canRollbackToSpecify(
  currentStage: Stage,
  targetStage: Stage,
  _workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  if (currentStage !== 'PLAN' || targetStage !== 'SPECIFY') {
    return { allowed: false, reason: 'Rollback only available from PLAN to SPECIFY stage' };
  }

  const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['FAILED', 'CANCELLED']);
  if (statusCheck) return statusCheck;

  return { allowed: true };
}

export function canRollbackToPlan(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  // BUILD → PLAN (FULL only)
  if (currentStage === 'BUILD' && targetStage === 'PLAN') {
    if (workflowType !== 'FULL') {
      return { allowed: false, reason: 'Rollback only available for FULL workflows.' };
    }
    const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['FAILED', 'CANCELLED']);
    if (statusCheck) return statusCheck;
    return { allowed: true };
  }

  // VERIFY → PLAN (FULL only, existing)
  if (currentStage === 'VERIFY' && targetStage === 'PLAN') {
    if (workflowType === 'QUICK') {
      return { allowed: false, reason: 'Rollback only available for FULL workflows. QUICK workflows skip PLAN stage.' };
    }
    if (workflowType === 'CLEAN') {
      return { allowed: false, reason: 'Rollback only available for FULL workflows. CLEAN workflows have different stage progression.' };
    }
    const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['COMPLETED', 'FAILED', 'CANCELLED']);
    if (statusCheck) return statusCheck;
    return { allowed: true };
  }

  return { allowed: false, reason: 'Invalid rollback transition to PLAN' };
}

export function canRollbackToBuild(
  currentStage: Stage,
  targetStage: Stage,
  _workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  if (currentStage !== 'VERIFY' || targetStage !== 'BUILD') {
    return { allowed: false, reason: 'Rollback only available from VERIFY to BUILD stage' };
  }

  const statusCheck = validateJobStatus(mostRecentWorkflowJob, ['FAILED', 'CANCELLED']);
  if (statusCheck) return statusCheck;

  return { allowed: true };
}

/**
 * Rollback confirmation messages for each transition.
 */
export const ROLLBACK_MESSAGES: Record<string, string> = {
  'SPECIFY→INBOX': 'Revenir à Inbox ? La branche sera supprimée.',
  'PLAN→SPECIFY': 'Revenir à Specify ? Le plan partiel sera écrasé au prochain run.',
  'BUILD→PLAN': 'Revenir à Plan ? Le code sera réinitialisé (backup créé).',
  'BUILD→INBOX': 'Revenir à Inbox ? Le ticket sera réinitialisé.',
  'VERIFY→BUILD': 'Revenir à Build ? Le code est conservé.',
  'VERIFY→PLAN': 'Revenir à Plan ? Le code sera réinitialisé (backup créé).',
};

/**
 * Check if a transition is a valid rollback and return the validation result.
 */
export function validateRollback(
  currentStage: Stage,
  targetStage: Stage,
  workflowType: WorkflowType,
  mostRecentWorkflowJob: Job | null
): RollbackValidation {
  if (targetStage === 'INBOX') {
    return canRollbackToInbox(currentStage, targetStage, workflowType, mostRecentWorkflowJob);
  }
  if (targetStage === 'SPECIFY') {
    return canRollbackToSpecify(currentStage, targetStage, workflowType, mostRecentWorkflowJob);
  }
  if (targetStage === 'PLAN') {
    return canRollbackToPlan(currentStage, targetStage, workflowType, mostRecentWorkflowJob);
  }
  if (targetStage === 'BUILD') {
    return canRollbackToBuild(currentStage, targetStage, workflowType, mostRecentWorkflowJob);
  }
  return { allowed: false, reason: 'Invalid rollback transition' };
}
