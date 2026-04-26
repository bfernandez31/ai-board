/**
 * Dispatch the backfill-outcomes workflow for a single project.
 *
 * Mirrors lib/workflows/dispatch-onboard.ts: TEST_MODE short-circuits (no GitHub call),
 * GITHUB_TOKEN provides auth, and inputs map to the workflow's `workflow_dispatch` block.
 */

import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export interface BackfillDispatchInputs {
  projectId: number;
  resumeCursor?: number | null;
}

export interface BackfillDispatchResult {
  workflowRunUrl: string | null;
}

export async function dispatchBackfillOutcomes(
  inputs: BackfillDispatchInputs
): Promise<BackfillDispatchResult> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[backfill-dispatch] Skipping workflow dispatch in test mode:', inputs);
    return { workflowRunUrl: null };
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
  const dispatchInputs: Record<string, string> = {
    project_id: String(inputs.projectId),
  };
  if (inputs.resumeCursor !== null && inputs.resumeCursor !== undefined) {
    dispatchInputs.resume_cursor = String(inputs.resumeCursor);
  }

  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: 'backfill-outcomes.yml',
    ref: 'main',
    inputs: dispatchInputs,
  });

  return {
    workflowRunUrl: `https://github.com/${owner}/${repo}/actions/workflows/backfill-outcomes.yml`,
  };
}
