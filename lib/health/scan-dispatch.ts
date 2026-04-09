import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import { getProjectServiceInputs } from '@/lib/workflows/service-inputs';
import { ensureFreshConfig } from '@/lib/config-sync';
import type { HealthScanType, Project } from '@prisma/client';

export interface HealthScanDispatchInputs {
  scan_id: string;
  project_id: string;
  scan_type: HealthScanType;
  base_commit: string;
  head_commit: string;
  githubRepository: string;
  target_repo_dir?: string;
  ai_board_checkout_dir?: string;
}

export async function dispatchHealthScanWorkflow(
  inputs: HealthScanDispatchInputs,
  project?: Pick<Project, 'id' | 'githubOwner' | 'githubRepo' | 'configSyncedAt' | 'config'>
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

  // Health scans always use Claude → resolve ANTHROPIC credential
  const projectId = parseInt(inputs.project_id, 10);
  if (!isNaN(projectId)) {
    const credential = await getOwnerCredential(projectId, 'ANTHROPIC');
    if (!credential) {
      throw new Error(getMissingCredentialError('ANTHROPIC'));
    }
  }

  // Ensure config is fresh before dispatch (auto-refresh if stale)
  if (project) {
    await ensureFreshConfig(project);
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
        ...inputs,
        ...(inputs.scan_type === 'TESTS'
          ? {
              target_repo_dir: inputs.target_repo_dir ?? 'target',
              ai_board_checkout_dir: inputs.ai_board_checkout_dir ?? 'ai-board',
            }
          : {}),
        ...(inputs.scan_type === 'TESTS' && getProjectServiceInputs(project)),
      },
    });
  } catch (error) {
    console.error('[health-scan-dispatch] Failed to dispatch workflow:', error);
    throw new Error(
      `Failed to dispatch health scan workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
