import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { hasRepoScope } from '@/lib/github/user-client';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    const userId = await requireAuth();

    const account = await prisma.account.findFirst({
      where: { userId, provider: 'github' },
      select: { id: true },
    });

    const hasGitHubAccount = !!account;
    const hasScope = hasGitHubAccount ? await hasRepoScope(userId) : false;

    return NextResponse.json({
      hasGitHubAccount,
      hasRepoScope: hasScope,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    console.error('Failed to check GitHub auth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
