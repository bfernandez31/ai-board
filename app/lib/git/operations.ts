import { Octokit } from '@octokit/rest';

export interface CommitAndPushOptions {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  commitMessage: string;
  authorName: string;
  authorEmail: string;
}

export interface CommitResult {
  commitSha: string;
}

export async function commitAndPush(options: CommitAndPushOptions): Promise<CommitResult> {
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
    return {
      commitSha: `mock-sha-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const octokit = new Octokit({ auth: githubToken });

  try {
    // Get current file SHA if it exists (needed for updates)
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: options.owner,
        repo: options.repo,
        path: options.filePath,
        ref: options.branch,
      });

      if ('sha' in data) {
        sha = data.sha;
      }
    } catch (error: any) {
      if (error.status !== 404) throw error;
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: options.owner,
      repo: options.repo,
      path: options.filePath,
      message: options.commitMessage,
      content: Buffer.from(options.content).toString('base64'),
      branch: options.branch,
      ...(sha && { sha }),
      committer: { name: options.authorName, email: options.authorEmail },
      author: { name: options.authorName, email: options.authorEmail },
    });

    return { commitSha: data.commit.sha || '' };
  } catch (error: any) {
    if (error.message?.includes('does not match') || error.message?.includes('conflict')) {
      throw new Error(
        'Unable to save: another user has modified this file. Please refresh and try again.'
      );
    }

    if (error.status === 404 && error.message?.includes('branch')) {
      throw new Error(`Branch '${options.branch}' not found in repository`);
    }

    throw new Error(`GitHub API error: ${error.message}`);
  }
}
