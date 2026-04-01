import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';
import { getOwnerCredential, MISSING_CREDENTIAL_ERROR } from '@/lib/ai-credentials/workflow';

export interface AIBoardWorkflowInputs {
  ticket_id: string;
  stage: string;
  branch: string;
  user_id: string;
  user: string;
  comment: string;
  job_id: string;
  project_id: string;
  githubRepository: string;
  agent: string;
}

export async function dispatchAIBoardWorkflow(
  inputs: AIBoardWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[dispatch-ai-board] Skipping workflow dispatch in test mode:', {
      ticket_id: inputs.ticket_id,
      stage: inputs.stage,
    });
    return;
  }

  // Check that the project owner has an AI credential configured
  const projectId = parseInt(inputs.project_id, 10);
  if (!isNaN(projectId)) {
    const credential = await getOwnerCredential(projectId);
    if (!credential) {
      throw new Error(MISSING_CREDENTIAL_ERROR);
    }
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
      workflow_id: 'ai-board-assist.yml',
      ref: 'main',
      inputs: { ...inputs },
    });
  } catch (error) {
    console.error('[dispatch-ai-board] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch AI-BOARD workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
