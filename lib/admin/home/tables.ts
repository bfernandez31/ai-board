import { prisma } from '@/lib/db/client';
import type { NewPayingRow, CancellationRow, TopUserRow, TopProjectRow } from './types';

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function listNewPayingUsers(days = 30, limit = 50): Promise<NewPayingRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const subs = await prisma.subscription.findMany({
    where: {
      plan: { in: ['PRO', 'TEAM'] },
      status: { in: ['ACTIVE', 'TRIALING'] },
      createdAt: { gte: since },
    },
    include: { user: { select: { email: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const now = new Date();
  return subs
    .filter((s) => s.user)
    .map((s) => ({
      email: s.user!.email,
      plan: s.plan as 'PRO' | 'TEAM',
      accountAgeDays: daysBetween(s.user!.createdAt, now),
      subscribedAt: s.createdAt.toISOString(),
    }));
}

export async function listRecentCancellations(days = 30, limit = 50): Promise<CancellationRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const subs = await prisma.subscription.findMany({
    where: {
      canceledAt: { gte: since },
      plan: { in: ['PRO', 'TEAM'] },
    },
    include: { user: { select: { email: true, createdAt: true } } },
    orderBy: { canceledAt: 'desc' },
    take: limit,
  });

  const now = new Date();
  return subs
    .filter((s) => s.user && s.canceledAt)
    .map((s) => ({
      email: s.user!.email,
      lostPlan: s.plan as 'PRO' | 'TEAM',
      accountAgeDays: daysBetween(s.user!.createdAt, now),
      canceledAt: s.canceledAt!.toISOString(),
    }));
}

export async function listTopUsersThisMonth(limit = 5): Promise<TopUserRow[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  type RawRow = { user_id: string; job_count: bigint | number };
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT p."userId" AS user_id, COUNT(j.id)::int AS job_count
    FROM "Job" j
    JOIN "Project" p ON p.id = j."projectId"
    WHERE j."startedAt" >= ${startOfMonth}
    GROUP BY p."userId"
    ORDER BY job_count DESC
    LIMIT ${limit}
  `;

  const userIds = rows.map((r) => r.user_id);
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { subscription: { select: { plan: true } } },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const result: TopUserRow[] = [];
  for (const r of rows) {
    const user = userMap.get(r.user_id);
    if (!user) continue;
    result.push({
      email: user.email,
      plan: user.subscription?.plan ?? 'FREE',
      jobsThisMonth: Number(r.job_count),
    });
  }
  return result;
}

export async function listTopProjectsThisMonth(limit = 5): Promise<TopProjectRow[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const grouped = await prisma.job.groupBy({
    by: ['projectId'],
    where: { startedAt: { gte: startOfMonth } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const projectIds = grouped.map((g) => g.projectId);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: { user: { select: { email: true } } },
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const result: TopProjectRow[] = [];
  for (const g of grouped) {
    const project = projectMap.get(g.projectId);
    if (!project) continue;
    result.push({
      projectKey: project.key,
      ownerEmail: project.user?.email ?? '',
      jobsThisMonth: g._count.id,
    });
  }
  return result;
}
