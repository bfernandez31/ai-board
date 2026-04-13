import { dispatchWorkflow } from '@/lib/workflows/dispatch';

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
  /** GitHub repository in format owner/repo */
  githubRepository: string;
}

/**
 * Dispatch Vercel deploy preview GitHub workflow
 *
 * Triggers the .github/workflows/deploy-preview.yml workflow
 * with the provided inputs for Vercel preview deployment.
 *
 * @param inputs Workflow dispatch inputs
 * @throws Error if GITHUB_TOKEN not configured or dispatch fails
 */
export async function dispatchDeployPreviewWorkflow(
  inputs: DeployPreviewWorkflowInputs
): Promise<void> {
  const projectId = parseInt(inputs.project_id, 10);

  try {
    await dispatchWorkflow({
      workflowId: 'deploy-preview.yml',
      projectId: isNaN(projectId) ? 0 : projectId,
      githubRepository: inputs.githubRepository,
      inputs: {
        ticket_id: inputs.ticket_id,
        project_id: inputs.project_id,
        branch: inputs.branch,
        job_id: inputs.job_id,
        githubRepository: inputs.githubRepository,
      },
    });
  } catch (error) {
    console.error('[dispatch-deploy-preview] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch deploy preview workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
