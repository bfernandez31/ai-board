import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';

/**
 * Cancel a GitHub Actions workflow run.
 * Fire-and-forget: logs errors but does not throw.
 */
export async function cancelWorkflowRun(
  workflowRunId: bigint,
  githubOwner: string,
  githubRepo: string
): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[cancel-workflow] Skipping cancel in test mode:', {
      workflowRunId: workflowRunId.toString(),
      githubOwner,
      githubRepo,
    });
    return true;
  }

  if (!githubToken) {
    console.error('[cancel-workflow] GITHUB_TOKEN not configured');
    return false;
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.actions.cancelWorkflowRun({
      owner: githubOwner,
      repo: githubRepo,
      run_id: Number(workflowRunId),
    });

    console.log('[cancel-workflow] Workflow run cancelled:', {
      workflowRunId: workflowRunId.toString(),
      githubOwner,
      githubRepo,
    });
    return true;
  } catch (error) {
    console.error('[cancel-workflow] Failed to cancel workflow run:', {
      workflowRunId: workflowRunId.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
