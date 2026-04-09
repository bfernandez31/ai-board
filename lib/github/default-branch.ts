import { Octokit } from '@octokit/rest';

export async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const repoInfo = await octokit.repos.get({ owner, repo });
  return repoInfo.data.default_branch;
}
