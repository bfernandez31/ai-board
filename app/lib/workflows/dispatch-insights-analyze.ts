import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';

export interface InsightsAnalyzeWorkflowInputs {
  reportId: number;
  periodStart: Date;
  periodEnd: Date;
}

export async function dispatchInsightsAnalyzeWorkflow(
  inputs: InsightsAnalyzeWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log(
      '[dispatch-insights-analyze] Skipping workflow dispatch in test mode:',
      {
        reportId: inputs.reportId,
        periodStart: inputs.periodStart.toISOString(),
        periodEnd: inputs.periodEnd.toISOString(),
      }
    );
    return;
  }

  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN not configured - required for workflow dispatch'
    );
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error(
      'GITHUB_OWNER and GITHUB_REPO environment variables required'
    );
  }

  const octokit = new Octokit({ auth: githubToken });

  await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: 'insights-analyze.yml',
    ref: 'main',
    inputs: {
      report_id: String(inputs.reportId),
      period_start: inputs.periodStart.toISOString(),
      period_end: inputs.periodEnd.toISOString(),
    },
  });
}
