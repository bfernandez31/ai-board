import { Octokit } from '@octokit/rest';

/**
 * GitHub workflow dispatch inputs for deploy preview workflow
 */
export interface DeployPreviewWorkflowInputs {
  /** Ticket ID */
  ticket_id: string;
  /** Project ID */
  project_id: string;
  /** Git branch name to deploy */
  branch: string;
  /** Job ID for status tracking */
  job_id: string;
  /** GitHub repository owner */
  githubOwner: string;
  /** GitHub repository name */
  githubRepo: string;
}

/**
 * Dispatch Vercel deploy preview GitHub workflow
 *
 * Triggers the .github/workflows/deploy-preview.yml workflow
 * with the provided inputs for Vercel preview deployment.
 *
 * @param inputs Workflow dispatch inputs
 * @throws Error if GITHUB_TOKEN not configured or dispatch fails
 *
 * @example
 * await dispatchDeployPreviewWorkflow({
 *   ticket_id: '123',
 *   project_id: '1',
 *   branch: '080-feature-branch',
 *   job_id: '456',
 * });
 */
export async function dispatchDeployPreviewWorkflow(
  inputs: DeployPreviewWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  // Skip GitHub API call in test mode (same logic as other dispatchers)
  const isTestMode =
    process.env.TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (!githubToken || githubToken.includes('test') || githubToken.includes('placeholder'));

  if (isTestMode) {
    console.log('[dispatch-deploy-preview] Skipping workflow dispatch in test mode:', {
      ticket_id: inputs.ticket_id,
      branch: inputs.branch,
    });
    return; // Exit early - no GitHub API call
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
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'deploy-preview.yml',
      ref: 'main', // Workflow runs on main branch
      inputs: {
        ticket_id: inputs.ticket_id,
        project_id: inputs.project_id,
        branch: inputs.branch,
        job_id: inputs.job_id,
        githubOwner: inputs.githubOwner,
        githubRepo: inputs.githubRepo,
      },
    });
  } catch (error) {
    console.error('[dispatch-deploy-preview] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch deploy preview workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
