import { prisma } from '@/lib/db/client';
import { getEffectivePlan } from '@/lib/billing/subscription';
import type {
  CancellationRow,
  DashboardSnapshot,
  PaidUserRow,
  TopProjectRow,
  TopUserRow,
} from './types';

export interface ActionableResult {
  tables: DashboardSnapshot['actionable'];
  totals: {
    newPayingUsersTotal: number;
    recentCancellationsTotal: number;
  };
}

const TABLE_CAP = 25;
const TOP_LIMIT = 5;

function nDaysAgoUtc(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}

async function computeNewPayingUsers(
  now: Date
): Promise<{ rows: PaidUserRow[]; total: number }> {
  const since = nDaysAgoUtc(now, 30);
  const where = {
    plan: { in: ['PRO', 'TEAM'] as Array<'PRO' | 'TEAM'> },
    status: { in: ['ACTIVE', 'TRIALING'] as Array<'ACTIVE' | 'TRIALING'> },
    createdAt: { gte: since },
  };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
      take: TABLE_CAP,
    }),
    prisma.subscription.count({ where }),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const mapped: PaidUserRow[] = rows.map((r) => ({
    userId: r.userId,
    email: emailById.get(r.userId) ?? '(no email)',
    plan: r.plan as 'PRO' | 'TEAM',
    activatedAt: r.createdAt.toISOString(),
    daysSinceActivation: daysBetween(now, r.createdAt),
  }));
  return { rows: mapped, total };
}

async function computeRecentCancellations(
  now: Date
): Promise<{ rows: CancellationRow[]; total: number }> {
  const since = nDaysAgoUtc(now, 30);
  const where = { canceledAt: { gte: since } };

  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: [{ canceledAt: 'desc' }, { userId: 'asc' }],
      take: TABLE_CAP,
    }),
    prisma.subscription.count({ where }),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const mapped: CancellationRow[] = rows
    .filter((r) => r.canceledAt !== null)
    .map((r) => ({
      userId: r.userId,
      email: emailById.get(r.userId) ?? '(no email)',
      lostPlan: r.plan,
      canceledAt: (r.canceledAt as Date).toISOString(),
      daysSinceCancellation: daysBetween(now, r.canceledAt as Date),
    }));
  return { rows: mapped, total };
}

async function computeTopActiveUsers(now: Date): Promise<TopUserRow[]> {
  const monthStart = startOfUtcMonth(now);
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { projectId: true, createdAt: true },
  });
  if (jobs.length === 0) return [];

  const projectIds = Array.from(new Set(jobs.map((j) => j.projectId)));
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, userId: true },
  });
  const projectIdToUser = new Map(projects.map((p) => [p.id, p.userId]));

  const aggregatesByUser = new Map<string, { count: number; lastJobAt: Date }>();
  for (const j of jobs) {
    const userId = projectIdToUser.get(j.projectId);
    if (!userId) continue;
    const existing = aggregatesByUser.get(userId);
    if (existing) {
      existing.count += 1;
      if (j.createdAt > existing.lastJobAt) existing.lastJobAt = j.createdAt;
    } else {
      aggregatesByUser.set(userId, { count: 1, lastJobAt: j.createdAt });
    }
  }

  const sorted = Array.from(aggregatesByUser.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    if (b[1].lastJobAt.getTime() !== a[1].lastJobAt.getTime()) {
      return b[1].lastJobAt.getTime() - a[1].lastJobAt.getTime();
    }
    return a[0].localeCompare(b[0]);
  });
  const topUserIds = sorted.slice(0, TOP_LIMIT).map(([userId]) => userId);
  if (topUserIds.length === 0) return [];

  const [users, subs] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, email: true },
    }),
    prisma.subscription.findMany({
      where: { userId: { in: topUserIds } },
      select: { userId: true, plan: true, status: true, gracePeriodEndsAt: true },
    }),
  ]);
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  const subByUser = new Map(subs.map((s) => [s.userId, s]));

  return topUserIds.map((userId) => {
    const agg = aggregatesByUser.get(userId)!;
    const sub = subByUser.get(userId);
    const plan = sub
      ? getEffectivePlan(sub.plan, sub.status, sub.gracePeriodEndsAt)
      : 'FREE';
    return {
      userId,
      email: emailByUser.get(userId) ?? '(no email)',
      plan,
      jobCount: agg.count,
      lastJobAt: agg.lastJobAt.toISOString(),
    };
  });
}

async function computeTopProjects(now: Date): Promise<TopProjectRow[]> {
  const monthStart = startOfUtcMonth(now);
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { projectId: true, createdAt: true },
  });
  if (jobs.length === 0) return [];

  const aggregatesByProject = new Map<number, { count: number; lastJobAt: Date }>();
  for (const j of jobs) {
    const existing = aggregatesByProject.get(j.projectId);
    if (existing) {
      existing.count += 1;
      if (j.createdAt > existing.lastJobAt) existing.lastJobAt = j.createdAt;
    } else {
      aggregatesByProject.set(j.projectId, { count: 1, lastJobAt: j.createdAt });
    }
  }

  const sorted = Array.from(aggregatesByProject.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    if (b[1].lastJobAt.getTime() !== a[1].lastJobAt.getTime()) {
      return b[1].lastJobAt.getTime() - a[1].lastJobAt.getTime();
    }
    return a[0] - b[0];
  });
  const topProjectIds = sorted.slice(0, TOP_LIMIT).map(([id]) => id);
  if (topProjectIds.length === 0) return [];

  const projects = await prisma.project.findMany({
    where: { id: { in: topProjectIds } },
    select: {
      id: true,
      key: true,
      name: true,
      user: { select: { email: true } },
    },
  });
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  return topProjectIds.map((id) => {
    const agg = aggregatesByProject.get(id)!;
    const project = projectsById.get(id);
    return {
      projectId: id,
      projectKey: project?.key ?? '',
      projectName: project?.name ?? '',
      ownerEmail: project?.user?.email ?? '(no email)',
      jobCount: agg.count,
      lastJobAt: agg.lastJobAt.toISOString(),
    };
  });
}

export async function computeActionable(now: Date = new Date()): Promise<ActionableResult> {
  const [newPayingUsers, recentCancellations, topActiveUsers, topProjects] =
    await Promise.all([
      computeNewPayingUsers(now),
      computeRecentCancellations(now),
      computeTopActiveUsers(now),
      computeTopProjects(now),
    ]);

  return {
    tables: {
      newPayingUsers: newPayingUsers.rows,
      recentCancellations: recentCancellations.rows,
      topActiveUsers,
      topProjects,
    },
    totals: {
      newPayingUsersTotal: newPayingUsers.total,
      recentCancellationsTotal: recentCancellations.total,
    },
  };
}
