import { Octokit } from '@octokit/rest';

/**
 * Custom error for when source branch is not found
 */
export class BranchNotFoundError extends Error {
  constructor(branch: string) {
    super(`Source branch not found: ${branch}`);
    this.name = 'BranchNotFoundError';
  }
}

/**
 * Custom error for GitHub permission issues
 */
export class GitHubPermissionError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'GitHubPermissionError';
  }
}

/**
 * Creates a new Git branch from an existing source branch using the GitHub API.
 *
 * This function:
 * 1. Fetches the SHA of the source branch using repos.getBranch()
 * 2. Creates a new ref pointing to that SHA using git.createRef()
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - GitHub repository owner/organization
 * @param repo - GitHub repository name
 * @param sourceBranch - Name of the source branch to fork from
 * @param newBranchName - Name for the new branch
 * @returns Promise with the created branch's SHA and ref
 * @throws BranchNotFoundError if source branch doesn't exist (404)
 * @throws GitHubPermissionError if permission denied (403)
 */
export async function createBranchFrom(
  octokit: Octokit,
  owner: string,
  repo: string,
  sourceBranch: string,
  newBranchName: string
): Promise<{ sha: string; ref: string }> {
  try {
    // Step 1: Get the SHA of the source branch
    const sourceBranchData = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: sourceBranch,
    });

    const sourceSha = sourceBranchData.data.commit.sha;

    // Step 2: Create new branch from that SHA
    const newBranch = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: sourceSha,
    });

    return {
      sha: sourceSha,
      ref: newBranch.data.ref,
    };
  } catch (error: unknown) {
    // Handle GitHub API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;

      if (status === 404) {
        throw new BranchNotFoundError(sourceBranch);
      }

      if (status === 403) {
        throw new GitHubPermissionError(
          error instanceof Error ? error.message : 'Permission denied'
        );
      }
    }

    // Re-throw other errors
    throw error;
  }
}
