import { prisma } from '@/lib/db/client';
import { dispatchWorkflow } from '@/lib/workflows/dispatch';
import type { CredentialProvider } from '@prisma/client';

export interface RollbackResetWorkflowInputs {
  ticketId: number;
  ticketKey: string;
  projectId: number;
  branch: string;
  githubOwner: string;
  githubRepo: string;
  stage?: string;
  provider?: CredentialProvider;
}

export interface RollbackResetDispatchResult {
  jobId: number;
}

/**
 * Dispatches the rollback-reset workflow using the consolidated dispatch helper.
 * Handles job creation and status updates on failure.
 */
export async function dispatchRollbackResetWorkflow(
  inputs: RollbackResetWorkflowInputs
): Promise<RollbackResetDispatchResult> {
  const job = await prisma.job.create({
    data: {
      ticketId: inputs.ticketId,
      projectId: inputs.projectId,
      command: 'rollback-reset',
      status: 'PENDING',
      branch: inputs.branch,
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  try {
    await dispatchWorkflow({
      workflowId: 'rollback-reset.yml',
      projectId: inputs.projectId,
      githubRepository: `${inputs.githubOwner}/${inputs.githubRepo}`,
      inputs: {
        ticket_id: inputs.ticketKey,
        project_id: inputs.projectId.toString(),
        branch: inputs.branch,
        job_id: job.id.toString(),
        githubRepository: `${inputs.githubOwner}/${inputs.githubRepo}`,
        stage: inputs.stage || 'verify',
      },
    });

    console.log('[dispatch-rollback-reset] Workflow dispatched successfully:', {
      ticketKey: inputs.ticketKey,
      branch: inputs.branch,
      jobId: job.id,
    });

    return { jobId: job.id };
  } catch (error) {
    console.error('[dispatch-rollback-reset] Failed to dispatch workflow:', error);

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', updatedAt: new Date() },
    });

    throw new Error(
      `Failed to dispatch rollback-reset workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
