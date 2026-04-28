import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import type { Agent } from '@prisma/client';

export interface InboxAnalysisDispatchInputs {
  analysis_id: string;
  project_id: string;
  ticket_id: string;
  githubRepository: string;
  agent?: Agent;
  model?: string;
}

export async function dispatchInboxAnalysisWorkflow(
  inputs: InboxAnalysisDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[inbox-analysis-dispatch] Skipping workflow dispatch in test mode:', {
      analysis_id: inputs.analysis_id,
      ticket_id: inputs.ticket_id,
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
      workflow_id: 'inbox-analysis.yml',
      ref: 'main',
      inputs: {
        analysis_id: inputs.analysis_id,
        project_id: inputs.project_id,
        ticket_id: inputs.ticket_id,
        githubRepository: inputs.githubRepository,
        agent: inputs.agent ?? 'CLAUDE',
        model: inputs.model ?? '',
      },
    });
  } catch (error) {
    console.error('[inbox-analysis-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch inbox analysis workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
