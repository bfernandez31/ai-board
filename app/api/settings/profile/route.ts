import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    const userId = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          where: { provider: 'github' },
          select: { access_token: true },
        },
        subscription: {
          select: { plan: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let githubUsername: string | null = null;
    let githubUrl: string | null = null;

    const githubAccount = user.accounts[0];
    if (githubAccount?.access_token) {
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${githubAccount.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          githubUsername = data.login ?? null;
          githubUrl = data.html_url ?? null;
        }
      } catch {
        // GitHub API failure is non-fatal; fields remain null
      }
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
      githubUsername,
      githubUrl,
      plan: user.subscription?.plan ?? 'FREE',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    console.error('Failed to load profile:', error);
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    );
  }
}
