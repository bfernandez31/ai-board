import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export interface CancelWorkflowRunResult {
  cancelled: boolean;
  alreadyFinished: boolean;
}

export async function cancelWorkflowRun(
  workflowRunId: bigint,
  githubRepository: string
): Promise<CancelWorkflowRunResult> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[cancelWorkflowRun] Test mode — skipping GitHub API call:', {
      workflowRunId: workflowRunId.toString(),
      githubRepository,
    });
    return { cancelled: true, alreadyFinished: false };
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured — required for workflow cancellation');
  }

  const [owner, repo] = githubRepository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid githubRepository format: "${githubRepository}". Expected "owner/repo".`);
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.actions.cancelWorkflowRun({
      owner,
      repo,
      run_id: Number(workflowRunId),
    });
    return { cancelled: true, alreadyFinished: false };
  } catch (error: unknown) {
    // 409 = workflow already finished
    if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
      return { cancelled: false, alreadyFinished: true };
    }
    throw error;
  }
}
