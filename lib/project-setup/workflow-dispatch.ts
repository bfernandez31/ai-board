import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export interface ProjectOnboardingWorkflowInputs {
  project_id: string;
  attempt_id: string;
  githubRepository: string;
  agent: string;
}

export async function dispatchProjectOnboardingWorkflow(
  inputs: ProjectOnboardingWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[project-onboarding-dispatch] Skipping workflow dispatch in test mode:', {
      project_id: inputs.project_id,
      attempt_id: inputs.attempt_id,
      agent: inputs.agent,
    });
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables required');
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'project-onboarding.yml',
      ref: 'main',
      inputs: { ...inputs },
    });
  } catch (error) {
    console.error('[project-onboarding-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch project onboarding workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
