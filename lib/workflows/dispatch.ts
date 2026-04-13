import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import { getProjectServiceInputs } from '@/lib/workflows/service-inputs';
import { ensureFreshConfig } from '@/lib/config-sync';
import type { Agent, Project } from '@prisma/client';

export type ProjectWithConfig = Pick<Project, 'id' | 'githubOwner' | 'githubRepo' | 'configSyncedAt' | 'config'>;

export interface DispatchOptions {
  workflowId: string;
  projectId: number;
  agent?: Agent | undefined;
  githubRepository: string;
  inputs: Record<string, string>;
  project?: ProjectWithConfig | undefined;
  skipConfigSync?: boolean;
}

/**
 * Consolidated GitHub workflow dispatch helper.
 * Handles test mode, credential validation, config synchronization, and service inputs.
 */
export async function dispatchWorkflow(options: DispatchOptions): Promise<void> {
  const { workflowId, projectId, agent, githubRepository, inputs, project, skipConfigSync } = options;
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log(`[workflow-dispatch] Skipping ${workflowId} in test mode:`, {
      projectId,
      agent,
      ...inputs,
    });
    return;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured - required for workflow dispatch');
  }

  // Validate BYOK credential before dispatch if agent is provided
  if (agent) {
    const provider = AGENT_PROVIDER_MAP[agent];
    const credential = await getOwnerCredential(projectId, provider);
    if (!credential) {
      throw new Error(getMissingCredentialError(provider));
    }
  }

  // Ensure config is fresh before dispatch (auto-refresh if stale)
  if (project && !skipConfigSync) {
    await ensureFreshConfig(project);
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables required');
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    const finalInputs = {
      ...inputs,
      ...getProjectServiceInputs(project),
    };

    console.log(`[workflow-dispatch] Dispatching ${workflowId}:`, {
      aiboardRepo: `${owner}/${repo}`,
      targetRepo: githubRepository,
      agent,
    });

    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref: 'main',
      inputs: finalInputs,
    });
  } catch (error) {
    console.error(`[workflow-dispatch] Failed to dispatch ${workflowId}:`, error);
    throw error;
  }
}
