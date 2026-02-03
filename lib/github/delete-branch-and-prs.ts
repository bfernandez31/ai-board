import { Octokit } from '@octokit/rest';

/**
 * Result of GitHub cleanup operation
 */
export interface GitHubCleanupResult {
  /**
   * Number of pull requests that were closed
   */
  prsClosed: number;

  /**
   * Whether the branch was successfully deleted
   * (false if branch was already deleted - idempotent operation)
   */
  branchDeleted: boolean;
}

/**
 * Deletes a Git branch and closes associated pull requests
 *
 * Performs cleanup in correct sequence:
 * 1. Find all open PRs with matching head branch
 * 2. Close all matching PRs (required before branch deletion)
 * 3. Delete the Git branch
 *
 * Idempotent operations:
 * - 404 errors for already-deleted branches/PRs are acceptable
 * - Returns success even if branch was already deleted
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (e.g., "bfernandez31")
 * @param repo - Repository name (e.g., "ai-board")
 * @param branchName - Branch name to delete (e.g., "084-drag-and-drop")
 * @returns Cleanup result with counts of closed PRs and branch deletion status
 *
 * @throws Error if GitHub API call fails (rate limit, permissions, network)
 *
 * @example
 * ```typescript
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 *
 * const result = await deleteBranchAndPRs(
 *   octokit,
 *   'bfernandez31',
 *   'ai-board',
 *   '084-drag-and-drop'
 * );
 *
 * console.log(`Closed ${result.prsClosed} PRs, deleted branch: ${result.branchDeleted}`);
 * ```
 */
export async function deleteBranchAndPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string
): Promise<GitHubCleanupResult> {
  try {
    // Step 1: Find all open PRs with matching head branch
    let prs: Array<{ number: number }> = [];
    try {
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${branchName}`,
        state: 'open',
      });
      prs = data;
    } catch (error: any) {
      // 404 errors mean the branch or repo doesn't exist - treat as no PRs to close
      if (error.status === 404) {
        prs = [];
      } else {
        throw error;
      }
    }

    // Step 2: Close all matching PRs
    // GitHub API requires PRs to be closed before branch deletion
    const closedPRs = await Promise.all(
      prs.map((pr) =>
        octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: pr.number,
          state: 'closed',
        })
      )
    );

    // Step 3: Delete the Git branch
    let branchDeleted = false;
    try {
      await octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`, // GitHub API expects refs/heads/ prefix
      });
      branchDeleted = true;
    } catch (error: any) {
      // 404 errors are acceptable (branch already deleted) - idempotent operation
      if (error.status === 404) {
        branchDeleted = false; // Branch was already deleted
      } else if (
        error.status === 422 &&
        error.message &&
        error.message.toLowerCase().includes('reference does not exist')
      ) {
        // 422 errors with "reference does not exist" message mean branch is already deleted
        // This is acceptable - treat as successful deletion (idempotent)
        branchDeleted = false;
      } else {
        // Re-throw other errors (permissions, rate limit, network, protected branches)
        throw error;
      }
    }

    return {
      prsClosed: closedPRs.length,
      branchDeleted,
    };
  } catch (error: any) {
    // Log error for debugging
    console.error('GitHub cleanup failed:', {
      owner,
      repo,
      branchName,
      error: error.message,
      status: error.status,
    });

    // Provide more specific error messages for common failures
    if (error.status === 403) {
      throw new Error(
        `GitHub API permission denied. Check token scope includes 'repo' access.`
      );
    }

    if (error.status === 429) {
      throw new Error(
        `GitHub API rate limit exceeded. Please try again later. Resets at: ${
          error.response?.headers?.['x-ratelimit-reset'] || 'unknown'
        }`
      );
    }

    if (error.status === 422) {
      throw new Error(
        `Cannot delete protected branch: ${branchName}. Remove branch protection in GitHub settings.`
      );
    }

    // Re-throw with original error message for other cases
    throw new Error(`GitHub cleanup failed: ${error.message}`);
  }
}
