import { Octokit } from '@octokit/rest';
import { isWorkflowTestMode } from './test-mode';

/**
 * Delete a git branch via GitHub API.
 * Fire-and-forget: logs errors but does not throw.
 */
export async function deleteBranch(
  branch: string,
  githubOwner: string,
  githubRepo: string
): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (isWorkflowTestMode(githubToken)) {
    console.log('[delete-branch] Skipping delete in test mode:', {
      branch,
      githubOwner,
      githubRepo,
    });
    return true;
  }

  if (!githubToken) {
    console.error('[delete-branch] GITHUB_TOKEN not configured');
    return false;
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.git.deleteRef({
      owner: githubOwner,
      repo: githubRepo,
      ref: `heads/${branch}`,
    });

    console.log('[delete-branch] Branch deleted:', {
      branch,
      githubOwner,
      githubRepo,
    });
    return true;
  } catch (error) {
    console.error('[delete-branch] Failed to delete branch:', {
      branch,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
