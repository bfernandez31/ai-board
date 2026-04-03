import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { createUserGitHubClient, requireRepoScope } from '@/lib/github/user-client';

export async function GET() {
  try {
    const userId = await requireAuth();
    await requireRepoScope(userId);

    const octokit = await createUserGitHubClient(userId);
    const { data } = await octokit.orgs.listForAuthenticatedUser({ per_page: 100 });

    const orgs = data.map((org) => ({
      login: org.login,
      avatarUrl: org.avatar_url,
    }));

    return NextResponse.json({ orgs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    if (error instanceof Error && (error as Error & { code?: string }).code === 'MISSING_SCOPE') {
      return NextResponse.json(
        { error: 'GitHub token lacks repo scope', code: 'MISSING_SCOPE' },
        { status: 403 }
      );
    }

    console.error('Failed to fetch GitHub orgs:', error);
    return NextResponse.json(
      { error: 'GitHub API error', code: 'GITHUB_ERROR' },
      { status: 502 }
    );
  }
}
