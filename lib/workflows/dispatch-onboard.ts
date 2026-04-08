import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import type { Agent, CredentialProvider } from '@prisma/client';

export interface OnboardDispatchInputs {
  project_id: string;
  job_id: string;
  githubRepository: string;
  agent: Agent;
}

const AGENT_TO_PROVIDER: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};

export async function dispatchOnboardWorkflow(
  inputs: OnboardDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[onboard-dispatch] Skipping workflow dispatch in test mode:', {
      project_id: inputs.project_id,
      job_id: inputs.job_id,
      agent: inputs.agent,
    });
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  const projectId = parseInt(inputs.project_id, 10);
  if (!isNaN(projectId)) {
    const provider = AGENT_TO_PROVIDER[inputs.agent];
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
        project_id: inputs.project_id,
        job_id: inputs.job_id,
        githubRepository: inputs.githubRepository,
        agent: inputs.agent,
      },
    });
  } catch (error) {
    console.error('[onboard-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch onboard workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
