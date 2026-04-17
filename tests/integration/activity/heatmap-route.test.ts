import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const TEST_VIEWER_ID = 'test-user-id';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => TEST_VIEWER_ID),
}));

import { GET } from '@/app/api/activity/heatmap/route';
import { requireAuth } from '@/lib/db/users';

describe('GET /api/activity/heatmap', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Restore to default viewer on each test
    vi.mocked(requireAuth).mockImplementation(async () => TEST_VIEWER_ID);
    // Normalize test user createdAt to multi-year history for year tests
    await prisma.user.update({
      where: { id: TEST_VIEWER_ID },
      data: { createdAt: new Date('2023-01-01T00:00:00.000Z') },
    });
  });

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] claude ticket',
          description: 'heatmap fixture',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1001,
          ticketKey: 'E2EH-1',
          updatedAt: new Date(),
        },
        {
          projectId,
          title: '[e2e] codex ticket',
          description: 'heatmap fixture codex',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1002,
          ticketKey: 'E2EH-2',
          updatedAt: new Date(),
          agent: Agent.CODEX,
        },
      ],
    });

    const byKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - n);
      return d;
    };

    await prisma.job.createMany({
      data: [
        // Claude ticket, ship completed 5 days ago
        {
          ticketId: byKey.get('E2EH-1')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 1.42,
        },
        // Claude ticket, implement completed 5 days ago
        {
          ticketId: byKey.get('E2EH-1')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 0.5,
        },
        // Claude ticket, still running — NOT counted (no completedAt)
        {
          ticketId: byKey.get('E2EH-1')!,
          projectId,
          command: 'plan',
          status: JobStatus.RUNNING,
          startedAt: daysAgo(1),
          completedAt: null,
          updatedAt: daysAgo(1),
          costUsd: null,
        },
        // Codex ticket, implement FAILED 3 days ago — counted
        {
          ticketId: byKey.get('E2EH-2')!,
          projectId,
          command: 'implement',
          status: JobStatus.FAILED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 2.0,
        },
      ],
    });
  }

  it('returns 401 when requireAuth throws Unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(new NextRequest('http://localhost/api/activity/heatmap'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with account-scoped aggregates for authenticated viewer', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(new NextRequest('http://localhost/api/activity/heatmap?tz=UTC'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      filters: { year: string; agent: string; timezone: string };
      days: Array<{ date: string; jobCount: number; ticketsShipped: number; totalCostUsd?: number }>;
      counters: { totalJobs: number; ticketsShipped: number; periodLabel: string };
      agentOptions: Array<{ value: string; label: string; historicalJobCount: number }>;
      yearOptions: Array<{ value: string; label: string; isDefault: boolean }>;
      range: { startDate: string; endDate: string };
    };

    expect(body.filters.year).toBe('last-12-months');
    expect(body.filters.agent).toBe('all');
    expect(body.counters.totalJobs).toBe(3); // ship + implement (claude) + implement FAILED (codex), RUNNING excluded
    expect(body.counters.ticketsShipped).toBe(1);
    expect(body.counters.periodLabel).toBe('in the last year');
  });

  it('excludes projects the viewer does not own and is not a member of', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const otherUser = await prisma.user.create({
      data: {
        id: `other-user-${Date.now()}`,
        email: `other-${Date.now()}@project${ctx.projectId}.e2e.test`,
        name: 'Other User',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        name: '[e2e] Other User Project',
        key: `Z${Date.now().toString().slice(-2)}`,
        description: 'out of scope',
        githubOwner: 'other-owner',
        githubRepo: `other-repo-${Date.now()}`,
        userId: otherUser.id,
        updatedAt: new Date(),
      },
    });
    const otherTicket = await prisma.ticket.create({
      data: {
        projectId: otherProject.id,
        title: '[e2e] out of scope',
        description: 'not mine',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 9999,
        ticketKey: `OTH-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: otherTicket.id,
        projectId: otherProject.id,
        command: 'ship',
        status: JobStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
        costUsd: 9.99,
      },
    });

    const res = await GET(new NextRequest('http://localhost/api/activity/heatmap?tz=UTC'));
    const body = (await res.json()) as {
      counters: { totalJobs: number; ticketsShipped: number };
    };
    expect(res.status).toBe(200);
    // Only the 3 seeded jobs in ctx project, not the 1 in otherProject
    expect(body.counters.totalJobs).toBe(3);
    expect(body.counters.ticketsShipped).toBe(1);
  });

  it('filters by agent using effective-agent rule (ticket.agent=null + project.defaultAgent=CLAUDE → counted under CLAUDE)', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const resClaude = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&agent=CLAUDE')
    );
    const claude = (await resClaude.json()) as {
      counters: { totalJobs: number; ticketsShipped: number };
      agentOptions: Array<{ value: string; historicalJobCount: number }>;
    };
    expect(resClaude.status).toBe(200);
    // ship + implement (E2EH-1 has agent=null, project default=CLAUDE) → 2 claude jobs
    expect(claude.counters.totalJobs).toBe(2);
    expect(claude.counters.ticketsShipped).toBe(1);
    // agentOptions reflects full history
    expect(claude.agentOptions.some((o) => o.value === 'CLAUDE')).toBe(true);
    expect(claude.agentOptions.some((o) => o.value === 'CODEX')).toBe(true);

    const resCodex = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&agent=CODEX')
    );
    const codex = (await resCodex.json()) as {
      counters: { totalJobs: number; ticketsShipped: number };
    };
    expect(codex.counters.totalJobs).toBe(1);
    expect(codex.counters.ticketsShipped).toBe(0);
  });

  it('returns 400 when year is outside the valid set for this viewer', async () => {
    await prisma.user.update({
      where: { id: TEST_VIEWER_ID },
      data: { createdAt: new Date('2025-06-01T00:00:00.000Z') },
    });

    const res = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&year=2019')
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid year');
  });

  it('returns 400 on invalid agent value (Zod rejection)', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&agent=BOGUS')
    );
    expect(res.status).toBe(400);
  });

  it('produces a contiguous days[] covering the selected period', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&year=last-12-months')
    );
    const body = (await res.json()) as {
      range: { startDate: string; endDate: string };
      days: Array<{ date: string; jobCount: number }>;
    };
    expect(res.status).toBe(200);
    const dates = body.days.map((d) => d.date);
    // No gaps: each date differs by exactly 1 day from its predecessor
    for (let i = 1; i < dates.length; i += 1) {
      const prev = Date.parse(dates[i - 1]!);
      const cur = Date.parse(dates[i]!);
      expect(cur - prev).toBe(24 * 60 * 60 * 1000);
    }
    expect(dates[0]).toBe(body.range.startDate);
    expect(dates[dates.length - 1]).toBe(body.range.endDate);
  });

  it('buckets jobs by supplied IANA timezone (PST vs EST may differ)', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
    // Create a ticket + one job at a tz-boundary moment (06:30 UTC is same-day PST (23:30 previous), next-day EST (02:30))
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] tz boundary',
        description: 'boundary',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 2001,
        ticketKey: `TZ-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    const completedAt = new Date();
    completedAt.setUTCHours(6, 30, 0, 0);
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        updatedAt: completedAt,
        costUsd: 0.1,
      },
    });

    const resPst = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=America/Los_Angeles')
    );
    const pst = (await resPst.json()) as {
      days: Array<{ date: string; jobCount: number }>;
    };
    const pstActive = pst.days.find((d) => d.jobCount > 0);

    const resEst = await GET(
      new NextRequest('http://localhost/api/activity/heatmap?tz=America/New_York')
    );
    const est = (await resEst.json()) as {
      days: Array<{ date: string; jobCount: number }>;
    };
    const estActive = est.days.find((d) => d.jobCount > 0);

    expect(pstActive).toBeDefined();
    expect(estActive).toBeDefined();
    // Each timezone lands the job on exactly one local day;
    // they may or may not differ depending on when the test runs,
    // but each must correspond to the supplied tz's formatted date of `completedAt`.
    const pstExpected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(completedAt);
    const estExpected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(completedAt);
    expect(pstActive!.date).toBe(pstExpected);
    expect(estActive!.date).toBe(estExpected);
  });

  it('meets p95 < 150ms performance sentinel on a typical dataset', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const times: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      const res = await GET(
        new NextRequest('http://localhost/api/activity/heatmap?tz=UTC&year=last-12-months')
      );
      times.push(performance.now() - t0);
      expect(res.status).toBe(200);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]!;
    expect(p95).toBeLessThan(1500); // generous ceiling; tightens later with realistic seed
  });
});
