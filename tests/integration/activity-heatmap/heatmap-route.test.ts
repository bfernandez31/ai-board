import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/activity-heatmap/route';
import type { HeatmapPayload } from '@/lib/analytics/heatmap-types';

function buildRequest(
  url: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { headers });
}

async function readJson(response: Response): Promise<HeatmapPayload> {
  const text = await response.text();
  return JSON.parse(text) as HeatmapPayload;
}

const TEST_USER_ID = 'test-user-id';

describe('Activity Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function seedBaseFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped claude',
          description: 'heatmap shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: `HM-${projectId}-1`,
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] shipped codex',
          description: 'heatmap shipped codex',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: `HM-${projectId}-2`,
          updatedAt: daysAgo(5),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] stage-only ship',
          description: 'stage set to SHIP but no ship job',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 3,
          ticketKey: `HM-${projectId}-3`,
          updatedAt: daysAgo(2),
        },
      ],
    });
    const byKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: byKey.get(`HM-${projectId}-1`)!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.25,
        },
        {
          ticketId: byKey.get(`HM-${projectId}-1`)!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: null,
        },
        {
          ticketId: byKey.get(`HM-${projectId}-2`)!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 0.75,
        },
        {
          ticketId: byKey.get(`HM-${projectId}-3`)!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
      ],
    });

    return byKey;
  }

  function authHeaders() {
    return {
      'x-test-user-id': TEST_USER_ID,
      'x-ai-board-test-auth-override': 'true',
    };
  }

  it('returns 401 for unauthenticated requests', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap')
    );
    expect(response.status).toBe(401);
  });

  it('returns default last-12-months payload shape', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    expect(response.status).toBe(200);
    const data = await readJson(response);
    expect(data.filters.period).toEqual({ kind: 'last-12-months' });
    expect(data.filters.agent).toBe('all');
    expect(data.days.length).toBeGreaterThanOrEqual(365);
    expect(data.days.length).toBeLessThanOrEqual(371);
  });

  it('returns a full calendar year window for ?period=<past year>', async () => {
    await seedBaseFixtures(ctx.projectId);
    const now = new Date();
    const pastYear = now.getFullYear() - 1;
    const response = await GET(
      buildRequest(
        `http://localhost/api/activity-heatmap?period=${pastYear}`,
        authHeaders()
      )
    );
    const data = await readJson(response);
    expect(data.meta.label).toBe(String(pastYear));
    expect(data.days[0]?.date).toBe(`${pastYear}-01-01`);
    expect(data.days[data.days.length - 1]?.date).toBe(`${pastYear}-12-31`);
  });

  it('clamps the current-year window to today', async () => {
    await seedBaseFixtures(ctx.projectId);
    const now = new Date();
    const currentYear = now.getFullYear();
    const response = await GET(
      buildRequest(
        `http://localhost/api/activity-heatmap?period=${currentYear}`,
        authHeaders()
      )
    );
    const data = await readJson(response);
    expect(data.days[0]?.date).toBe(`${currentYear}-01-01`);
    const last = data.days[data.days.length - 1]?.date ?? '';
    expect(last.startsWith(String(currentYear))).toBe(true);
    const lastDate = new Date(`${last}T23:59:59Z`);
    expect(lastDate.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
  });

  it('silently coerces out-of-range years to last-12-months', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest(
        `http://localhost/api/activity-heatmap?period=1999`,
        authHeaders()
      )
    );
    expect(response.status).toBe(200);
    const data = await readJson(response);
    expect(data.filters.period).toEqual({ kind: 'last-12-months' });
  });

  it('effective-agent scoping returns only matching tickets jobs', async () => {
    await seedBaseFixtures(ctx.projectId);
    const responseAll = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const all = await readJson(responseAll);
    const allJobs = all.totals.jobs;

    const responseCodex = await GET(
      buildRequest(
        'http://localhost/api/activity-heatmap?agent=CODEX',
        authHeaders()
      )
    );
    const codex = await readJson(responseCodex);
    expect(codex.filters.agent).toBe('CODEX');
    expect(codex.totals.jobs).toBeGreaterThan(0);
    expect(codex.totals.jobs).toBeLessThan(allJobs);
  });

  it('does NOT count stage=SHIP tickets that lack a successful ship job', async () => {
    const byKey = await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const data = await readJson(response);
    const stageOnlyKey = `HM-${ctx.projectId}-3`;
    const appearsAsShipped = data.days.some((d) =>
      d.shippedTickets.some((t) => t.ticketKey === stageOnlyKey)
    );
    expect(appearsAsShipped).toBe(false);
    expect(data.totals.shippedTickets).toBe(2);
    expect(byKey.has(stageOnlyKey)).toBe(true);
  });

  it('keeps totalCost=null when no non-null costs for the day', async () => {
    const projectId = ctx.projectId;
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        projectId,
        title: '[e2e] null cost ticket',
        description: 'null cost',
        stage: Stage.INBOX,
        workflowType: WorkflowType.FULL,
        ticketNumber: 77,
        ticketKey: `NC-${projectId}-77`,
        updatedAt: daysAgo(4),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'plan',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(4),
        completedAt: daysAgo(4),
        updatedAt: daysAgo(4),
        costUsd: null,
      },
    });

    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const data = await readJson(response);
    const dayKey = data.days.find((d) => d.jobCount > 0);
    expect(dayKey).toBeDefined();
    if (dayKey) {
      expect(dayKey.totalCost).toBeNull();
    }
  });

  it('includes jobs from member-only projects and excludes no-access projects', async () => {
    const projectId = ctx.projectId;
    await seedBaseFixtures(projectId);

    const otherUser = await prisma.user.upsert({
      where: { email: `heatmap-owner-${projectId}@test.com` },
      update: {},
      create: {
        id: `heatmap-owner-${projectId}`,
        email: `heatmap-owner-${projectId}@test.com`,
        name: 'Heatmap Owner',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    const memberProject = await prisma.project.create({
      data: {
        key: `HMM${projectId}`.slice(0, 6),
        name: '[e2e] heatmap member project',
        description: 'member-only project',
        githubOwner: 'test',
        githubRepo: `heatmap-member-${projectId}`,
        userId: otherUser.id,
        updatedAt: new Date(),
        defaultAgent: Agent.CLAUDE,
      },
    });
    await prisma.projectMember.create({
      data: { projectId: memberProject.id, userId: TEST_USER_ID },
    });
    const noAccessProject = await prisma.project.create({
      data: {
        key: `HMN${projectId}`.slice(0, 6),
        name: '[e2e] heatmap no-access',
        description: 'no access',
        githubOwner: 'test',
        githubRepo: `heatmap-noaccess-${projectId}`,
        userId: otherUser.id,
        updatedAt: new Date(),
        defaultAgent: Agent.CLAUDE,
      },
    });

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const memberTicket = await prisma.ticket.create({
      data: {
        projectId: memberProject.id,
        title: '[e2e] member ticket',
        description: 'member',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: `MM-${memberProject.id}-1`,
        updatedAt: daysAgo(1),
      },
    });
    const noAccessTicket = await prisma.ticket.create({
      data: {
        projectId: noAccessProject.id,
        title: '[e2e] no-access ticket',
        description: 'no-access',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: `NA-${noAccessProject.id}-1`,
        updatedAt: daysAgo(1),
      },
    });
    await prisma.job.createMany({
      data: [
        {
          ticketId: memberTicket.id,
          projectId: memberProject.id,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 2.0,
        },
        {
          ticketId: noAccessTicket.id,
          projectId: noAccessProject.id,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 3.0,
        },
      ],
    });

    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const data = await readJson(response);
    const memberKey = `MM-${memberProject.id}-1`;
    const noAccessKey = `NA-${noAccessProject.id}-1`;
    const allShippedKeys = data.days.flatMap((d) =>
      d.shippedTickets.map((t) => t.ticketKey)
    );
    expect(allShippedKeys).toContain(memberKey);
    expect(allShippedKeys).not.toContain(noAccessKey);
  });

  it('computes distinctAgents cardinality correctly', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const data = await readJson(response);
    expect(new Set(data.distinctAgents).size).toBe(data.distinctAgents.length);
    expect(data.distinctAgents).toContain('CLAUDE');
    expect(data.distinctAgents).toContain('CODEX');
  });

  it('enforces monotonic thresholds (t1 <= t2 <= t3 <= t4, all >= 1)', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    const data = await readJson(response);
    expect(data.thresholds.t1).toBeGreaterThanOrEqual(1);
    expect(data.thresholds.t1).toBeLessThanOrEqual(data.thresholds.t2);
    expect(data.thresholds.t2).toBeLessThanOrEqual(data.thresholds.t3);
    expect(data.thresholds.t3).toBeLessThanOrEqual(data.thresholds.t4);
  });

  it('falls back to UTC for invalid timezone strings', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest(
        'http://localhost/api/activity-heatmap?tz=not%2Fa%2Freal',
        authHeaders()
      )
    );
    const data = await readJson(response);
    expect(data.filters.timezone).toBe('UTC');
  });

  it('sets Content-Type and Cache-Control: private, no-store', async () => {
    await seedBaseFixtures(ctx.projectId);
    const response = await GET(
      buildRequest('http://localhost/api/activity-heatmap', authHeaders())
    );
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
