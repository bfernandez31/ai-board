import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

let currentUserId: string | null = 'test-user-id';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => {
    if (!currentUserId) {
      throw new Error('Unauthorized');
    }
    return currentUserId;
  }),
  getCurrentUser: vi.fn(async () => {
    if (!currentUserId) {
      throw new Error('Unauthorized');
    }
    return { id: currentUserId, email: 'test@e2e.local', name: 'Test' };
  }),
  getCurrentUserOrNull: vi.fn(async () =>
    currentUserId
      ? { id: currentUserId, email: 'test@e2e.local', name: 'Test' }
      : null
  ),
}));

import { GET } from '@/app/api/activity/heatmap/route';

interface JobSeed {
  ticketKey: string;
  command: string;
  status: JobStatus;
  completedAt: Date;
  costUsd?: number | null;
}

async function seedUser(email: string, id: string, createdAt: Date): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.user.upsert({
    where: { email },
    update: { createdAt },
    create: {
      id,
      email,
      name: 'Heatmap test user',
      emailVerified: new Date(),
      createdAt,
      updatedAt: new Date(),
    },
  });
}

async function clearUserDataIfNeeded(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.user.deleteMany({
    where: { id: userId },
  });
}

describe('Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    currentUserId = 'test-user-id';
  });

  async function seedSingleProjectJobs(
    projectId: number,
    defaultAgent: Agent,
    jobs: JobSeed[],
    tickets: Array<{
      key: string;
      number: number;
      agent?: Agent | null;
      stage?: Stage;
      closedAt?: Date | null;
      updatedAt?: Date | null;
    }>
  ): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent },
    });

    await prisma.ticket.createMany({
      data: tickets.map((t) => ({
        projectId,
        title: `[e2e] ${t.key}`,
        description: 'heatmap seed',
        stage: t.stage ?? Stage.INBOX,
        workflowType: WorkflowType.FULL,
        ticketNumber: t.number,
        ticketKey: t.key,
        agent: t.agent ?? null,
        ...(t.closedAt ? { closedAt: t.closedAt } : {}),
      })),
    });

    for (const t of tickets) {
      if (t.updatedAt) {
        await prisma.$executeRaw`
          UPDATE "Ticket" SET "updatedAt" = ${t.updatedAt}
          WHERE "projectId" = ${projectId} AND "ticketNumber" = ${t.number}
        `;
      }
    }

    const ticketRows = await prisma.ticket.findMany({
      where: { projectId, ticketKey: { in: tickets.map((t) => t.key) } },
      select: { id: true, ticketKey: true },
    });
    const idByKey = new Map(ticketRows.map((t) => [t.ticketKey, t.id]));

    for (const job of jobs) {
      const ticketId = idByKey.get(job.ticketKey);
      if (!ticketId) {
        throw new Error(`seed: missing ticket ${job.ticketKey}`);
      }
      await prisma.job.create({
        data: {
          ticketId,
          projectId,
          command: job.command,
          status: job.status,
          startedAt: job.completedAt,
          completedAt: job.completedAt,
          updatedAt: job.completedAt,
          costUsd: job.costUsd ?? null,
        },
      });
    }
  }

  it('returns 401 when unauthenticated', async () => {
    currentUserId = null;
    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    currentUserId = 'test-user-id';
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns a full rolling-12m envelope with default filters and owner access', async () => {
    const now = new Date();
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-1',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(10),
          costUsd: 1.0,
        },
        {
          ticketKey: 'HM-1',
          command: 'ship',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(9),
          costUsd: 0.5,
        },
        {
          ticketKey: 'HM-2',
          command: 'verify',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(30),
          costUsd: 1.5,
        },
      ],
      [
        { key: 'HM-1', number: 1001, stage: Stage.SHIP, updatedAt: daysAgo(9) },
        { key: 'HM-2', number: 1002 },
      ]
    );

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      cells: Array<{ date: string; jobCount: number; bucket: number; shipJobCount: number }>;
      summary: { totalJobs: number; distinctShippedTickets: number; periodLabel: string };
      filters: { period: { kind: string }; agent: string };
      period: { kind: string };
    };
    expect(data.filters.period.kind).toBe('rolling12m');
    expect(data.filters.agent).toBe('all');
    expect(data.period.kind).toBe('rolling12m');
    expect(data.cells.length).toBeGreaterThanOrEqual(365);
    expect(data.cells.length).toBeLessThanOrEqual(366);
    expect(data.summary.totalJobs).toBe(3);
    expect(data.summary.distinctShippedTickets).toBe(1);
    expect(data.summary.periodLabel).toBe('in the last year');

    const byDate = new Map(data.cells.map((c) => [c.date, c]));
    const hmOneKey = formatDateKey(daysAgo(9));
    const shipDay = byDate.get(hmOneKey);
    expect(shipDay?.shipJobCount).toBe(1);
  });

  it('aggregates jobs from projects the user is a member of', async () => {
    const now = new Date();
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-OWNED',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(5),
          costUsd: 1.0,
        },
      ],
      [{ key: 'HM-OWNED', number: 2001 }]
    );

    // Seed a second project owned by a different user that 'test-user-id' is a member of
    await clearUserDataIfNeeded('heatmap-other-owner');
    await seedUser('heatmap-owner@e2e.local', 'heatmap-other-owner', new Date('2024-01-01'));
    const otherProject = await prisma.project.create({
      data: {
        name: '[e2e] Heatmap Member Project',
        description: 'member project',
        githubOwner: 'member-owner',
        githubRepo: `member-${Date.now()}`,
        userId: 'heatmap-other-owner',
        key: `M${Math.floor(Math.random() * 999)}`.slice(0, 3).padEnd(3, 'X'),
        defaultAgent: Agent.CLAUDE,
        updatedAt: new Date(),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: otherProject.id,
        userId: 'test-user-id',
      },
    });

    const ticket = await prisma.ticket.create({
      data: {
        projectId: otherProject.id,
        title: '[e2e] member ticket',
        description: 'member',
        stage: Stage.INBOX,
        workflowType: WorkflowType.FULL,
        ticketNumber: 9001,
        ticketKey: `${otherProject.key}-M1`,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: otherProject.id,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(3),
        completedAt: daysAgo(3),
        updatedAt: daysAgo(3),
        costUsd: 2.0,
      },
    });

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { summary: { totalJobs: number } };
    expect(data.summary.totalJobs).toBe(2);

    await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: 'heatmap-other-owner' } }).catch(() => undefined);
  });

  it('coerces invalid period to rolling12m', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?period=1999')
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as { filters: { period: { kind: string } } };
    expect(data.filters.period.kind).toBe('rolling12m');
  });

  it('returns period.kind=year with startDate Jan 1 for valid year filter', async () => {
    // Set user created in 2024 so 2025 is valid
    await seedUser('test@e2e.local', 'test-user-id', new Date('2024-01-01'));
    const response = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?period=2025')
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      period: { kind: string; startDate: string; endDate: string; year?: number };
      cells: Array<{ date: string }>;
    };
    expect(data.period.kind).toBe('year');
    expect(data.period.year).toBe(2025);
    expect(data.period.startDate).toBe('2025-01-01');
    expect(data.period.endDate).toBe('2025-12-31');
    expect(data.cells.length).toBe(365);
  });

  it('excludes explicit CODEX tickets when filtering by CLAUDE', async () => {
    const now = new Date();
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-CLAUDE',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(4),
          costUsd: 0.5,
        },
        {
          ticketKey: 'HM-CODEX',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(4),
          costUsd: 0.5,
        },
      ],
      [
        { key: 'HM-CLAUDE', number: 3001 },
        { key: 'HM-CODEX', number: 3002, agent: Agent.CODEX },
      ]
    );

    const response = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?agent=CLAUDE')
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as { summary: { totalJobs: number } };
    expect(data.summary.totalJobs).toBe(1);
  });

  it('includes tickets inheriting project.defaultAgent under the effective-agent filter', async () => {
    const now = new Date();
    const daysAgo = (n: number): Date => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-INHERIT',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: daysAgo(6),
          costUsd: 1.0,
        },
      ],
      [{ key: 'HM-INHERIT', number: 3101, agent: null }]
    );

    const response = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?agent=CLAUDE')
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      summary: { totalJobs: number };
      availableAgents: Array<{ value: string }>;
    };
    expect(data.summary.totalJobs).toBe(1);
    expect(data.availableAgents.map((a) => a.value)).toContain('CLAUDE');
  });

  it('emits totalCostUsd === null when any contributing job lacks cost', async () => {
    const now = new Date();
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 12, 0, 0, 0)
    );

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-COST1',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: target,
          costUsd: 0.5,
        },
        {
          ticketKey: 'HM-COST1',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: target,
          costUsd: 0.25,
        },
        {
          ticketKey: 'HM-COST1',
          command: 'implement',
          status: JobStatus.COMPLETED,
          completedAt: target,
          costUsd: null,
        },
      ],
      [{ key: 'HM-COST1', number: 3201 }]
    );

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    const data = (await response.json()) as {
      cells: Array<{ date: string; totalCostUsd: number | null; jobCount: number }>;
    };
    const key = formatDateKey(target);
    const cell = data.cells.find((c) => c.date === key);
    expect(cell?.jobCount).toBe(3);
    expect(cell?.totalCostUsd).toBeNull();
  });

  it('counts two ship jobs on same ticket same day as shipJobCount=2 shippedTicketCount=1', async () => {
    const now = new Date();
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 12, 0, 0, 0)
    );

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [
        {
          ticketKey: 'HM-SHIP2X',
          command: 'ship',
          status: JobStatus.COMPLETED,
          completedAt: target,
          costUsd: 0.1,
        },
        {
          ticketKey: 'HM-SHIP2X',
          command: 'ship',
          status: JobStatus.COMPLETED,
          completedAt: target,
          costUsd: 0.1,
        },
      ],
      [{ key: 'HM-SHIP2X', number: 3301, stage: Stage.SHIP, updatedAt: target }]
    );

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    const data = (await response.json()) as {
      cells: Array<{ date: string; shipJobCount: number; shippedTicketCount: number }>;
      summary: { distinctShippedTickets: number };
    };
    const key = formatDateKey(target);
    const cell = data.cells.find((c) => c.date === key);
    expect(cell?.shipJobCount).toBe(2);
    expect(cell?.shippedTicketCount).toBe(1);
    expect(data.summary.distinctShippedTickets).toBe(1);
  });

  it('returns all-zero buckets and zero thresholds when there is no activity', async () => {
    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    const data = (await response.json()) as {
      cells: Array<{ bucket: number; jobCount: number }>;
      thresholds: { p25: number; p50: number; p75: number; maxJobCount: number };
    };
    expect(data.cells.every((c) => c.bucket === 0)).toBe(true);
    expect(data.cells.every((c) => c.jobCount === 0)).toBe(true);
    expect(data.thresholds).toEqual({ p25: 0, p50: 0, p75: 0, maxJobCount: 0 });
  });

  it('places all non-zero days in bucket 1 when they share the same count (empty-bucket-1 guard)', async () => {
    const now = new Date();
    const day = (offset: number): Date =>
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 12, 0, 0, 0)
      );

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      [1, 2, 3].map((offset) => ({
        ticketKey: 'HM-FLAT',
        command: 'implement',
        status: JobStatus.COMPLETED,
        completedAt: day(offset),
        costUsd: 0.1,
      })),
      [{ key: 'HM-FLAT', number: 3401 }]
    );

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    const data = (await response.json()) as {
      cells: Array<{ jobCount: number; bucket: number }>;
    };
    const nonZero = data.cells.filter((c) => c.jobCount > 0);
    expect(nonZero.length).toBe(3);
    expect(nonZero.every((c) => c.bucket === 1)).toBe(true);
  });

  it('places an outlier day in bucket 4 while lower-count days distribute below', async () => {
    const now = new Date();
    const day = (offset: number): Date =>
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 12, 0, 0, 0)
      );

    // Four days with 1 job, one outlier day with many
    const jobs: JobSeed[] = [];
    for (let i = 1; i <= 4; i += 1) {
      jobs.push({
        ticketKey: 'HM-OUTLIER',
        command: 'implement',
        status: JobStatus.COMPLETED,
        completedAt: day(i),
        costUsd: 0.1,
      });
    }
    for (let n = 0; n < 20; n += 1) {
      jobs.push({
        ticketKey: 'HM-OUTLIER',
        command: 'implement',
        status: JobStatus.COMPLETED,
        completedAt: day(10),
        costUsd: 0.1,
      });
    }

    await seedSingleProjectJobs(
      ctx.projectId,
      Agent.CLAUDE,
      jobs,
      [{ key: 'HM-OUTLIER', number: 3501 }]
    );

    const response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    const data = (await response.json()) as {
      cells: Array<{ jobCount: number; bucket: number }>;
    };
    const outlier = data.cells.find((c) => c.jobCount === 20);
    expect(outlier?.bucket).toBe(4);
  });

  it('lists availableYears descending from currentYear down to accountCreationYear, [] when created this year', async () => {
    const prismaClient = getPrismaClient();
    const currentYear = new Date().getUTCFullYear();

    // User created in current year → []
    await seedUser('test@e2e.local', 'test-user-id', new Date(Date.UTC(currentYear, 5, 1)));
    let response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    let data = (await response.json()) as { availableYears: number[] };
    expect(data.availableYears).toEqual([]);

    // User created two years ago → descending list
    await seedUser(
      'test@e2e.local',
      'test-user-id',
      new Date(Date.UTC(currentYear - 2, 0, 1))
    );
    response = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    data = (await response.json()) as { availableYears: number[] };
    expect(data.availableYears).toEqual([currentYear, currentYear - 1, currentYear - 2]);

    // restore
    await prismaClient.user.update({
      where: { id: 'test-user-id' },
      data: { createdAt: new Date('2024-01-01') },
    });
  });
});

function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
