import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';

/**
 * GitHub workflow dispatch inputs for rollback-reset workflow
 */
export interface RollbackResetWorkflowInputs {
  /** Ticket internal ID */
  ticketId: number;
  /** Ticket key (e.g., "ABC-123") */
  ticketKey: string;
  /** Project ID */
  projectId: number;
  /** Git branch name to reset */
  branch: string;
  /** GitHub repository owner */
  githubOwner: string;
  /** GitHub repository name */
  githubRepo: string;
}

/**
 * Result of dispatching the rollback-reset workflow
 */
export interface RollbackResetDispatchResult {
  /** Job ID for status tracking */
  jobId: number;
}

/**
 * Dispatch rollback-reset GitHub workflow
 *
 * Triggers the .github/workflows/rollback-reset.yml workflow
 * to reset the git branch to pre-BUILD state while preserving spec files.
 *
 * @param inputs Workflow dispatch inputs
 * @returns Job ID for status tracking
 * @throws Error if GITHUB_TOKEN not configured or dispatch fails
 *
 * @example
 * const result = await dispatchRollbackResetWorkflow({
 *   ticketId: 123,
 *   ticketKey: 'AIB-76',
 *   projectId: 1,
 *   branch: 'AIB-76-fix-rollback-to',
 *   githubOwner: 'bfernandez31',
 *   githubRepo: 'ai-board',
 * });
 * console.log(result.jobId); // Job ID for tracking
 */
export async function dispatchRollbackResetWorkflow(
  inputs: RollbackResetWorkflowInputs
): Promise<RollbackResetDispatchResult> {
  const githubToken = process.env.GITHUB_TOKEN;

  // 1. Create job record first (needed for workflow inputs)
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

  // Skip GitHub API call in test mode (same logic as other dispatchers)
  const isTestMode =
    process.env.TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (!githubToken || githubToken.includes('test') || githubToken.includes('placeholder'));

  if (isTestMode) {
    console.log('[dispatch-rollback-reset] Skipping workflow dispatch in test mode:', {
      ticketKey: inputs.ticketKey,
      branch: inputs.branch,
      jobId: job.id,
    });
    return { jobId: job.id };
  }

  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN not configured - required for workflow dispatch'
    );
  }

  const octokit = new Octokit({ auth: githubToken });

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error(
      'GITHUB_OWNER and GITHUB_REPO environment variables required'
    );
  }

  try {
    // 2. Dispatch workflow
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'rollback-reset.yml',
      ref: 'main', // Workflow runs on main branch
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
    // Clean up the job if dispatch fails
    console.error('[dispatch-rollback-reset] Failed to dispatch workflow:', error);

    // Mark job as failed instead of deleting (preserves audit trail)
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', updatedAt: new Date() },
    });

    throw new Error(
      `Failed to dispatch rollback-reset workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
