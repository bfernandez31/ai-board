import { Octokit } from '@octokit/rest';

/**
 * Result of PR closure operation
 */
export interface ClosePRsResult {
  /**
   * Number of pull requests that were closed
   */
  prsClosed: number;
}

/**
 * Closes all open pull requests for a branch without deleting the branch.
 *
 * Used when closing a ticket - PRs should be closed but the branch
 * is preserved for future reference (FR-008 requirement).
 *
 * Idempotent operations:
 * - Returns 0 if no open PRs exist
 * - 404 errors for already-closed PRs are acceptable
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (e.g., "bfernandez31")
 * @param repo - Repository name (e.g., "ai-board")
 * @param branchName - Branch name to find PRs for
 * @param closeComment - Optional comment to add before closing
 * @returns Result with count of closed PRs
 *
 * @throws Error if GitHub API call fails (rate limit, permissions, network)
 *
 * @example
 * ```typescript
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 *
 * const result = await closePRsOnly(
 *   octokit,
 *   'bfernandez31',
 *   'ai-board',
 *   '084-drag-and-drop',
 *   'Ticket closed without shipping.'
 * );
 *
 * console.log(`Closed ${result.prsClosed} PRs`);
 * ```
 */
export async function closePRsOnly(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  closeComment?: string
): Promise<ClosePRsResult> {
  try {
    // Step 1: Find all open PRs with matching head branch
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branchName}`,
      state: 'open',
    });

    // If no PRs, return early (idempotent)
    if (prs.length === 0) {
      return { prsClosed: 0 };
    }

    // Step 2: Close all matching PRs with optional comment
    await Promise.all(
      prs.map(async (pr) => {
        // Add closure comment if provided
        if (closeComment) {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pr.number,
            body: closeComment,
          });
        }

        // Close the PR
        await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: pr.number,
          state: 'closed',
        });
      })
    );

    return { prsClosed: prs.length };
  } catch (error: any) {
    // Log error for debugging
    console.error('PR closure failed:', {
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

    // Re-throw with original error message for other cases
    throw new Error(`PR closure failed: ${error.message}`);
  }
}
