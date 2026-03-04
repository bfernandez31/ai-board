import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';

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
      inputs: {
        ticket_id: inputs.ticket_id,
        stage: inputs.stage,
        branch: inputs.branch,
        user_id: inputs.user_id,
        user: inputs.user,
        comment: inputs.comment,
        job_id: inputs.job_id,
        project_id: inputs.project_id,
        githubRepository: inputs.githubRepository,
      },
    });
  } catch (error) {
    console.error('[dispatch-ai-board] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch AI-BOARD workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
