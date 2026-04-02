import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { createUserGitHubClient, requireRepoScope } from '@/lib/github/user-client';
import { prisma } from '@/lib/db/client';

interface RepoPickerItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  description: string | null;
  isPrivate: boolean;
  pushedAt: string | null;
  hasAdminAccess: boolean;
  isAlreadyImported: boolean;
  existingProjectId: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    await requireRepoScope(userId);

    const octokit = await createUserGitHubClient(userId);
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '30', 10)));
    const sort = (searchParams.get('sort') ?? 'pushed') as 'pushed' | 'updated' | 'full_name';
    const type = (searchParams.get('type') ?? 'all') as 'all' | 'owner' | 'member';
    const org = searchParams.get('org') ?? undefined;
    const q = searchParams.get('q') ?? undefined;

    let repos: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string; avatar_url: string };
      description: string | null;
      private: boolean;
      pushed_at: string | null;
      permissions?: { admin: boolean; push: boolean; pull: boolean };
    }>;
    let totalCount: number;

    if (q) {
      // Use GitHub Search API for text search
      const { data: user } = await octokit.users.getAuthenticated();
      const searchQuery = org
        ? `${q} org:${org} fork:true`
        : `${q} user:${user.login} fork:true`;

      const searchParams_: Parameters<typeof octokit.search.repos>[0] = {
        q: searchQuery,
        order: 'desc',
        per_page: perPage,
        page,
      };
      if (sort === 'updated') {
        searchParams_.sort = 'updated';
      }

      const { data } = await octokit.search.repos(searchParams_);

      repos = data.items.map((item) => {
        const mapped: (typeof repos)[number] = {
          id: item.id,
          name: item.name,
          full_name: item.full_name,
          owner: {
            login: item.owner?.login ?? '',
            avatar_url: item.owner?.avatar_url ?? '',
          },
          description: item.description,
          private: item.private,
          pushed_at: item.pushed_at ?? null,
        };
        if (item.permissions) {
          mapped.permissions = item.permissions as { admin: boolean; push: boolean; pull: boolean };
        }
        return mapped;
      });
      totalCount = data.total_count;
    } else if (org) {
      const orgParams: Parameters<typeof octokit.repos.listForOrg>[0] = {
        org,
        direction: 'desc',
        per_page: perPage,
        page,
        type: 'all',
      };
      if (sort !== 'full_name') {
        orgParams.sort = sort;
      }
      const { data, headers } = await octokit.repos.listForOrg(orgParams);

      repos = data.map((r) => {
        const mapped: (typeof repos)[number] = {
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          owner: { login: r.owner.login, avatar_url: r.owner.avatar_url },
          description: r.description,
          private: r.private,
          pushed_at: r.pushed_at ?? null,
        };
        if (r.permissions) {
          mapped.permissions = r.permissions as { admin: boolean; push: boolean; pull: boolean };
        }
        return mapped;
      });
      totalCount = parseTotalFromLink(headers.link ?? undefined, data.length, page, perPage);
    } else {
      const { data, headers } = await octokit.repos.listForAuthenticatedUser({
        sort: sort === 'full_name' ? 'full_name' : sort,
        direction: sort === 'full_name' ? 'asc' : 'desc',
        per_page: perPage,
        page,
        type,
      });

      repos = data.map((r) => {
        const mapped: (typeof repos)[number] = {
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          owner: { login: r.owner.login, avatar_url: r.owner.avatar_url },
          description: r.description,
          private: r.private,
          pushed_at: r.pushed_at,
        };
        if (r.permissions) {
          mapped.permissions = r.permissions as { admin: boolean; push: boolean; pull: boolean };
        }
        return mapped;
      });
      totalCount = parseTotalFromLink(headers.link ?? undefined, data.length, page, perPage);
    }

    // Batch-check which repos are already imported
    const importedProjects = repos.length > 0
      ? await prisma.project.findMany({
          where: {
            OR: repos.map((r) => ({
              githubOwner: r.owner.login,
              githubRepo: r.name,
            })),
          },
          select: { id: true, githubOwner: true, githubRepo: true },
        })
      : [];

    const importedMap = new Map(
      importedProjects.map((p) => [`${p.githubOwner}/${p.githubRepo}`, p.id])
    );

    const items: RepoPickerItem[] = repos.map((r) => {
      const key = `${r.owner.login}/${r.name}`;
      const existingProjectId = importedMap.get(key) ?? null;

      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        ownerAvatar: r.owner.avatar_url,
        description: r.description,
        isPrivate: r.private,
        pushedAt: r.pushed_at,
        hasAdminAccess: r.permissions?.admin ?? false,
        isAlreadyImported: existingProjectId !== null,
        existingProjectId,
      };
    });

    const hasNextPage = repos.length === perPage;

    return NextResponse.json({
      repos: items,
      totalCount,
      page,
      perPage,
      hasNextPage,
    });
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

    // Check for rate limit errors
    if (error instanceof Error && error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'GitHub rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    console.error('Failed to fetch GitHub repos:', error);
    return NextResponse.json(
      { error: 'GitHub API error', code: 'GITHUB_ERROR' },
      { status: 502 }
    );
  }
}

/**
 * Estimate total count from GitHub Link header (pagination).
 * Falls back to current page data count.
 */
function parseTotalFromLink(
  link: string | undefined,
  currentCount: number,
  page: number,
  perPage: number
): number {
  if (!link) {
    // No Link header means this is the only page
    return (page - 1) * perPage + currentCount;
  }

  const lastMatch = link.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
  if (lastMatch?.[1]) {
    return parseInt(lastMatch[1], 10) * perPage;
  }

  // If there's a "next" link but no "last", estimate
  if (link.includes('rel="next"')) {
    return (page + 1) * perPage; // At least one more page
  }

  return (page - 1) * perPage + currentCount;
}
