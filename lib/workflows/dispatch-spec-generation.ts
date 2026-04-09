import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import type { Agent, SpecDepth } from '@prisma/client';

export interface SpecGenDispatchInputs {
  project_id: string;
  job_id: string;
  githubRepository: string;
  agent: Agent;
  depth: SpecDepth;
  documentation_url: string;
  additional_context: string;
}

export async function dispatchSpecGenerationWorkflow(
  inputs: SpecGenDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[spec-gen-dispatch] Skipping workflow dispatch in test mode:', {
      project_id: inputs.project_id,
      job_id: inputs.job_id,
      agent: inputs.agent,
      depth: inputs.depth,
    });
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  const projectId = parseInt(inputs.project_id, 10);
  if (!isNaN(projectId)) {
    const provider = AGENT_PROVIDER_MAP[inputs.agent];
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
      workflow_id: 'retro-spec.yml',
      ref: 'main',
      inputs: {
        project_id: inputs.project_id,
        job_id: inputs.job_id,
        githubRepository: inputs.githubRepository,
        agent: inputs.agent,
        depth: inputs.depth,
        documentation_url: inputs.documentation_url,
        additional_context: inputs.additional_context,
      },
    });
  } catch (error) {
    console.error('[spec-gen-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch spec generation workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
