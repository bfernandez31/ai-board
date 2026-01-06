import { Octokit } from '@octokit/rest';

/**
 * Result of closing PRs for a branch
 */
export interface ClosePRsResult {
  /**
   * Number of pull requests that were successfully closed
   */
  prsClosed: number;

  /**
   * Number of PRs that were already closed (idempotent)
   */
  prsAlreadyClosed: number;
}

/**
 * Closes all open PRs for a branch with an explanatory comment
 * Does NOT delete the branch (preserves for future reference)
 *
 * Idempotent operations:
 * - 404 errors for already-closed PRs are acceptable
 * - 422 errors (validation failed) are treated as already-closed
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner (e.g., "bfernandez31")
 * @param repo - Repository name (e.g., "ai-board")
 * @param branchName - Branch name whose PRs to close (e.g., "084-feature")
 * @param comment - Comment to add before closing the PR
 * @returns Result with counts of closed and already-closed PRs
 *
 * @throws Error if GitHub API call fails (rate limit, permissions, network)
 *
 * @example
 * ```typescript
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 *
 * const result = await closePRsForBranch(
 *   octokit,
 *   'bfernandez31',
 *   'ai-board',
 *   '148-close-feature',
 *   'Closed by ai-board - ticket moved to CLOSED state'
 * );
 *
 * console.log(`Closed ${result.prsClosed} PRs`);
 * ```
 */
export async function closePRsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  comment: string
): Promise<ClosePRsResult> {
  // Find all open PRs with matching head branch
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  let prsClosed = 0;
  let prsAlreadyClosed = 0;

  // Close each PR with comment
  for (const pr of prs) {
    try {
      // Add explanatory comment before closing
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: comment,
      });

      // Close the PR
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: 'closed',
      });

      prsClosed++;
    } catch (error: any) {
      // 404 or 422 errors mean PR is already closed or not accessible - idempotent
      if (error.status === 404 || error.status === 422) {
        prsAlreadyClosed++;
      } else {
        throw error;
      }
    }
  }

  return { prsClosed, prsAlreadyClosed };
}
