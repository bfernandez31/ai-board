import { Octokit } from '@octokit/rest';

/**
 * GitHub workflow dispatch inputs for AI-BOARD assist workflow
 */
export interface AIBoardWorkflowInputs {
  /** Ticket ID */
  ticket_id: string;
  /** Ticket title */
  ticketTitle: string;
  /** Current stage */
  stage: string;
  /** Git branch name */
  branch: string;
  /** Requester username (for mention) */
  user: string;
  /** Comment content (user request) */
  comment: string;
  /** Job ID for status tracking */
  job_id: string;
  /** Project ID */
  project_id: string;
  /** GitHub repository in format owner/repo */
  githubRepository: string;
}

/**
 * Dispatch AI-BOARD assist GitHub workflow
 *
 * Triggers the .github/workflows/ai-board-assist.yml workflow
 * with the provided inputs for ticket assistance.
 *
 * @param inputs Workflow dispatch inputs
 * @throws Error if GITHUB_TOKEN not configured or dispatch fails
 *
 * @example
 * await dispatchAIBoardWorkflow({
 *   ticket_id: '123',
 *   ticketTitle: 'Add error handling',
 *   stage: 'specify',
 *   branch: '123-add-error-handling',
 *   user: 'john-doe',
 *   comment: '@ai-board please add network timeout handling',
 *   job_id: '456',
 *   project_id: '1',
 * });
 */
export async function dispatchAIBoardWorkflow(
  inputs: AIBoardWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  // Skip GitHub API call in test mode (same logic as transition.ts)
  const isTestMode =
    process.env.TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (!githubToken || githubToken.includes('test') || githubToken.includes('placeholder'));

  if (isTestMode) {
    console.log('[dispatch-ai-board] Skipping workflow dispatch in test mode:', {
      ticket_id: inputs.ticket_id,
      stage: inputs.stage,
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
      workflow_id: 'ai-board-assist.yml',
      ref: 'main', // Workflow runs on main branch
      inputs: {
        ticket_id: inputs.ticket_id,
        ticketTitle: inputs.ticketTitle,
        stage: inputs.stage,
        branch: inputs.branch,
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
