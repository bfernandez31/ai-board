import { Octokit } from '@octokit/rest';
import { prisma } from '@/lib/db/client';

/**
 * Retrieve the GitHub OAuth access token for a user from the Account model.
 */
export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'github' },
    select: { access_token: true },
  });

  return account?.access_token ?? null;
}

/**
 * Check whether the user's stored GitHub OAuth scope includes `repo`.
 */
export async function hasRepoScope(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'github' },
    select: { scope: true },
  });

  if (!account?.scope) return false;

  // Scope is a comma-separated or space-separated string
  const scopes = account.scope.split(/[,\s]+/);
  return scopes.includes('repo');
}

/**
 * Create an Octokit client authenticated with the user's GitHub OAuth token.
 * Throws if the user has no GitHub account or no access token.
 */
export async function createUserGitHubClient(userId: string): Promise<Octokit> {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error('No GitHub access token found for user');
  }

  return new Octokit({ auth: token });
}

/**
 * Require that the user's GitHub token has `repo` scope.
 * Throws an error with code MISSING_SCOPE if not.
 */
export async function requireRepoScope(userId: string): Promise<void> {
  const hasScope = await hasRepoScope(userId);
  if (!hasScope) {
    const error = new Error('GitHub token lacks repo scope');
    (error as Error & { code: string }).code = 'MISSING_SCOPE';
    throw error;
  }
}
