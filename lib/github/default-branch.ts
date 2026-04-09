/**
 * Shared utility to resolve a repository's default branch from the GitHub API.
 * Reuses the pattern established in lib/config-sync.ts (repos.get → default_branch).
 */
import { Octokit } from '@octokit/rest';

/**
 * Fetch the default branch name for a GitHub repository.
 * Returns the value of `default_branch` from the GitHub repos API
 * (e.g. "main", "master", "develop").
 */
export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const repoInfo = await octokit.repos.get({ owner, repo });
  return repoInfo.data.default_branch;
}
