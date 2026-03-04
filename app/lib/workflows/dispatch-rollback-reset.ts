import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';
import { isWorkflowTestMode } from './test-mode';

export interface RollbackResetWorkflowInputs {
  ticketId: number;
  ticketKey: string;
  projectId: number;
  branch: string;
  githubOwner: string;
  githubRepo: string;
}

export interface RollbackResetDispatchResult {
  jobId: number;
}

export async function dispatchRollbackResetWorkflow(
  inputs: RollbackResetWorkflowInputs
): Promise<RollbackResetDispatchResult> {
  const githubToken = process.env.GITHUB_TOKEN;

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

  if (isWorkflowTestMode(githubToken)) {
    console.log('[dispatch-rollback-reset] Skipping workflow dispatch in test mode:', {
      ticketKey: inputs.ticketKey,
      branch: inputs.branch,
      jobId: job.id,
    });
    return { jobId: job.id };
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  const octokit = new Octokit({ auth: githubToken });
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables required');
  }

  try {
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'rollback-reset.yml',
      ref: 'main',
      inputs: {
        ticket_id: inputs.ticketKey,
        project_id: inputs.projectId.toString(),
        branch: inputs.branch,
        job_id: job.id.toString(),
        githubRepository: `${inputs.githubOwner}/${inputs.githubRepo}`,
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
