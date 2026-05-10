import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export interface AdminInsightsDispatchInputs {
  report_id: string;
}

export async function dispatchAdminInsightsWorkflow(
  inputs: AdminInsightsDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[admin-insights-dispatch] Skipping workflow dispatch in test mode:', {
      report_id: inputs.report_id,
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
      workflow_id: 'admin-insights.yml',
      ref: 'main',
      inputs: {
        report_id: inputs.report_id,
      },
    });
  } catch (error) {
    console.error('[admin-insights-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch admin-insights workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
