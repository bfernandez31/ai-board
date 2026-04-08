import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import type { Agent } from '@prisma/client';

export interface OnboardDispatchInputs {
  setup_job_id: string;
  project_id: string;
  selected_agent: Agent;
  githubRepository: string;
}

/**
 * Dispatch the onboard workflow to set up a project's configuration.
 * Follows the same pattern as lib/health/scan-dispatch.ts.
 */
export async function dispatchOnboardWorkflow(
  inputs: OnboardDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[onboard-dispatch] Skipping workflow dispatch in test mode:', {
      setup_job_id: inputs.setup_job_id,
      selected_agent: inputs.selected_agent,
    });
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  // Validate credential for selected agent
  const projectId = parseInt(inputs.project_id, 10);
  const provider = AGENT_PROVIDER_MAP[inputs.selected_agent];
  if (!isNaN(projectId)) {
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      throw new Error(getMissingCredentialError(provider));
    }
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
      workflow_id: 'onboard.yml',
      ref: 'main',
      inputs: {
        setup_job_id: inputs.setup_job_id,
        project_id: inputs.project_id,
        selected_agent: inputs.selected_agent,
        githubRepository: inputs.githubRepository,
      },
    });
  } catch (error) {
    console.error('[onboard-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch onboard workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
