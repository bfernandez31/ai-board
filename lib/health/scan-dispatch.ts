import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import type { HealthScanType } from '@prisma/client';

export interface HealthScanDispatchInputs {
  scan_id: string;
  project_id: string;
  scan_type: HealthScanType;
  base_commit: string;
  head_commit: string;
  githubRepository: string;
}

export async function dispatchHealthScanWorkflow(
  inputs: HealthScanDispatchInputs
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[health-scan-dispatch] Skipping workflow dispatch in test mode:', {
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
        scan_id: inputs.scan_id,
        project_id: inputs.project_id,
        scan_type: inputs.scan_type,
        base_commit: inputs.base_commit,
        head_commit: inputs.head_commit,
        githubRepository: inputs.githubRepository,
      },
    });
  } catch (error) {
    console.error('[health-scan-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch health scan workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
