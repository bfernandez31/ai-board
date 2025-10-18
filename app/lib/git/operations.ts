import { Octokit } from '@octokit/rest';

/**
 * Options for committing and pushing changes to GitHub
 */
export interface CommitAndPushOptions {
  /** GitHub repository owner (e.g., 'bfernandez31') */
  owner: string;
  /** GitHub repository name (e.g., 'ai-board') */
  repo: string;
  /** Branch name (e.g., '036-mode-to-update') */
  branch: string;
  /** File path relative to repository root (e.g., 'specs/036-mode-to-update/spec.md') */
  filePath: string;
  /** New file content */
  content: string;
  /** Commit message */
  commitMessage: string;
  /** Git author name */
  authorName: string;
  /** Git author email */
  authorEmail: string;
}

/**
 * Result of a successful commit and push operation
 */
export interface CommitResult {
  /** Git commit SHA (40 character hex string) */
  commitSha: string;
}

/**
 * Commits and pushes file changes to GitHub using GitHub API
 *
 * This function uses @octokit/rest to create or update files via GitHub API,
 * which is serverless-compatible (no local git repository required).
 *
 * @param options - Commit and push configuration
 * @returns Promise resolving to commit SHA
 * @throws Error if GitHub API request fails or branch doesn't exist
 *
 * @example
 * const result = await commitAndPush({
 *   owner: 'bfernandez31',
 *   repo: 'ai-board',
 *   branch: '036-mode-to-update',
 *   filePath: 'specs/036-mode-to-update/spec.md',
 *   content: '# Updated Spec\n\nNew content',
 *   commitMessage: 'docs: update spec.md',
 *   authorName: 'User Name',
 *   authorEmail: 'user@example.com',
 * });
 * console.log('Committed:', result.commitSha);
 */
export async function commitAndPush(options: CommitAndPushOptions): Promise<CommitResult> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    // Step 1: Get current file SHA (needed for updates)
    // If file doesn't exist yet, sha will remain undefined (for new file creation)
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: options.owner,
        repo: options.repo,
        path: options.filePath,
        ref: options.branch,
      });

      // GitHub API returns either file content or directory listing
      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error: any) {
      // 404 error means file doesn't exist yet - that's okay, we'll create it
      if (error.status !== 404) {
        throw error;
      }
    }

    // Step 2: Create or update file via GitHub API
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: options.owner,
      repo: options.repo,
      path: options.filePath,
      message: options.commitMessage,
      content: Buffer.from(options.content).toString('base64'), // GitHub API requires base64 encoding
      branch: options.branch,
      sha, // Required for updates, omit for new files
      committer: {
        name: options.authorName,
        email: options.authorEmail,
      },
      author: {
        name: options.authorName,
        email: options.authorEmail,
      },
    });

    return {
      commitSha: data.commit.sha || '',
    };
  } catch (error: any) {
    // Handle merge conflicts (when remote has newer changes)
    if (error.message?.includes('does not match') || error.message?.includes('conflict')) {
      throw new Error(
        'Unable to save: another user has modified this file. Please refresh and try again.'
      );
    }

    // Handle branch not found
    if (error.status === 404 && error.message?.includes('branch')) {
      throw new Error(`Branch '${options.branch}' not found in repository`);
    }

    // Re-throw with more context
    throw new Error(`GitHub API error: ${error.message}`);
  }
}
