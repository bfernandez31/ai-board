/**
 * GitHub API client initialization
 *
 * Provides authenticated Octokit instance for GitHub operations
 */

import { Octokit } from '@octokit/rest';

/**
 * Create an authenticated Octokit instance
 *
 * @returns Authenticated Octokit client
 * @throws Error if GITHUB_TOKEN environment variable is not set
 *
 * @example
 * const octokit = createGitHubClient();
 * const { data } = await octokit.repos.getContent({...});
 */
export function createGitHubClient(): Octokit {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  return new Octokit({ auth: githubToken });
}
