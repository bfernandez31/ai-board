import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';

export interface HealthScanWorkflowInputs {
  project_id: string;
  scan_type: string;
  scan_id: string;
  base_commit: string;
  head_commit: string;
  githubRepository: string;
}

export async function dispatchHealthScanWorkflow(
  inputs: HealthScanWorkflowInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[dispatch-health-scan] Skipping workflow dispatch in test mode:', {
      scan_id: inputs.scan_id,
      scan_type: inputs.scan_type,
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
      workflow_id: 'health-scan.yml',
      ref: 'main',
      inputs: {
        project_id: inputs.project_id,
        scan_type: inputs.scan_type,
        scan_id: inputs.scan_id,
        base_commit: inputs.base_commit,
        head_commit: inputs.head_commit,
        githubRepository: inputs.githubRepository,
      },
    });
  } catch (error) {
    console.error('[dispatch-health-scan] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch health-scan workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
