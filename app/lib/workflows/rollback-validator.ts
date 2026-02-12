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
  if (currentStage !== 'BUILD' || targetStage !== 'INBOX') {
    return { allowed: false, reason: 'Rollback only available from BUILD to INBOX stage' };
  }

  if (workflowType !== 'QUICK') {
    return { allowed: false, reason: 'Rollback only available for quick-impl workflows. Normal workflows cannot be rolled back.' };
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
  if (currentStage !== 'VERIFY' || targetStage !== 'PLAN') {
    return { allowed: false, reason: 'Rollback only available from VERIFY to PLAN stage' };
  }

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
