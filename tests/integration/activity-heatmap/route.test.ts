import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';

let currentAuthUserId: string | null = null;

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => {
    if (currentAuthUserId === null) {
      throw new Error('Unauthorized');
    }
    return currentAuthUserId;
  }),
}));

import { GET } from '@/app/api/activity-heatmap/route';

interface HeatmapCell {
  date: string;
  jobCount: number;
  costUsd: number | null;
  nullCostJobCount: number;
  shippedTickets: Array<{ ticketId: number | null; title: string | null }>;
  intensity: 0 | 1 | 2 | 3 | 4;
}

interface HeatmapBody {
  period: {
    kind: 'rolling12m' | 'calendarYear';
    year?: number;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  counters: { jobCount: number; shippedTicketCount: number };
  cells: HeatmapCell[];
  intensityThresholds: [number, number, number, number];
  availableAgents: string[];
  yearSelector: { calendarYears: number[]; currentYear: number };
}

describe('Activity heatmap route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    currentAuthUserId = await getTestUserId();
  });

  async function makeRequest(query = ''): Promise<{ status: number; body: HeatmapBody | { error: string } }> {
    const url = `http://localhost/api/activity-heatmap${query ? `?${query}` : ''}`;
    const response = await GET(new NextRequest(url));
    const body = (await response.json()) as HeatmapBody | { error: string };
    return { status: response.status, body };
  }

  it('returns 401 for unauthenticated request', async () => {
    currentAuthUserId = null;
    const { status, body } = await makeRequest();
    expect(status).toBe(401);
    expect((body as { error: string }).error).toBe('Unauthorized');
  });

  it('returns empty aggregate with cells covering every day and zero thresholds', async () => {
    const { status, body } = await makeRequest();
    expect(status).toBe(200);
    const heatmap = body as HeatmapBody;

    expect(heatmap.counters.jobCount).toBe(0);
    expect(heatmap.counters.shippedTicketCount).toBe(0);
    expect(heatmap.intensityThresholds).toEqual([0, 0, 0, 0]);
    // Rolling 12 months ≈ 365 or 366 cells
    expect(heatmap.cells.length).toBeGreaterThanOrEqual(365);
    expect(heatmap.cells.length).toBeLessThanOrEqual(366);
    // Every cell should be zero / intensity 0
    for (const cell of heatmap.cells) {
      expect(cell.jobCount).toBe(0);
      expect(cell.intensity).toBe(0);
    }
  });

  it('falls back to UTC when tz is invalid', async () => {
    const { status, body } = await makeRequest('tz=Not/A_Zone');
    expect(status).toBe(200);
    expect((body as HeatmapBody).period.timezone).toBe('UTC');
  });

  it('aggregates jobs across owner + member projects and respects invariants', async () => {
    const ownerUserId = currentAuthUserId!;
    const memberProjectOwner = await prisma.user.create({
      data: {
        id: `heat-owner-${Date.now()}`,
        email: `heat-owner-${Date.now()}@project${ctx.projectId}.e2e.test`,
        name: 'Heatmap Other Owner',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    const memberProject = await prisma.project.create({
      data: {
        name: '[e2e] Heatmap Member Project',
        key: `HM${Date.now().toString().slice(-3)}`,
        description: 'Heatmap member project',
        githubOwner: 'test',
        githubRepo: `heatmap-mem-${Date.now()}`,
        userId: memberProjectOwner.id,
        defaultAgent: Agent.CLAUDE,
        updatedAt: new Date(),
      },
    });
    await prisma.projectMember.create({
      data: { projectId: memberProject.id, userId: ownerUserId },
    });

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [ownerTicket, memberTicket] = await Promise.all([
      prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: '[e2e] owner ticket',
          description: 'owner ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 101,
          ticketKey: `HO-${Date.now()}`,
          updatedAt: daysAgo(3),
        },
      }),
      prisma.ticket.create({
        data: {
          projectId: memberProject.id,
          title: '[e2e] member ticket',
          description: 'member ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: `HM-${Date.now()}`,
          updatedAt: daysAgo(5),
        },
      }),
    ]);

    await prisma.job.createMany({
      data: [
        {
          ticketId: ownerTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.5,
        },
        {
          ticketId: ownerTicket.id,
          projectId: ctx.projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: null,
        },
        {
          ticketId: memberTicket.id,
          projectId: memberProject.id,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 1.25,
        },
      ],
    });

    const { status, body } = await makeRequest();
    expect(status).toBe(200);
    const heatmap = body as HeatmapBody;

    expect(heatmap.counters.jobCount).toBe(3);
    expect(heatmap.counters.shippedTicketCount).toBe(1);
    const cellsSum = heatmap.cells.reduce((acc, c) => acc + c.jobCount, 0);
    expect(cellsSum).toBe(heatmap.counters.jobCount);
    for (const cell of heatmap.cells) {
      expect(cell.jobCount === 0).toBe(cell.intensity === 0);
    }
  });

  it('day-level cost sums exclude null costs and track nullCostJobCount', async () => {
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] mixed-cost',
        description: 'mixed-cost jobs',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 201,
        ticketKey: `MC-${Date.now()}`,
        updatedAt: daysAgo(1),
      },
    });

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 2.0,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: null,
        },
      ],
    });

    const { body } = await makeRequest();
    const heatmap = body as HeatmapBody;
    const active = heatmap.cells.find((c) => c.jobCount === 2);
    expect(active).toBeDefined();
    expect(active!.costUsd).toBe(2.0);
    expect(active!.nullCostJobCount).toBe(1);
  });

  it('respects calendar-year query parameter', async () => {
    const year = new Date().getUTCFullYear();
    const { status, body } = await makeRequest(`y=${year}`);
    expect(status).toBe(200);
    const heatmap = body as HeatmapBody;
    expect(heatmap.period.kind).toBe('calendarYear');
    expect(heatmap.period.year).toBe(year);
    expect(heatmap.period.startDate).toBe(`${year}-01-01`);
    expect(heatmap.period.endDate).toBe(`${year}-12-31`);
  });

  it('silently coerces out-of-range year to rolling12m', async () => {
    const { status, body } = await makeRequest('y=1999');
    expect(status).toBe(200);
    expect((body as HeatmapBody).period.kind).toBe('rolling12m');
  });

  it('returns 400 on invalid filters', async () => {
    const { status, body } = await makeRequest('y=abc');
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe('Invalid heatmap filters');
  });

  it('filters by effective agent, counting null-agent tickets under project defaultAgent', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [claudeTicket, codexTicket] = await Promise.all([
      prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: '[e2e] null-agent (defaults to Claude)',
          description: 'null agent',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 301,
          ticketKey: `NA-${Date.now()}`,
          updatedAt: daysAgo(4),
          // agent omitted (null) → resolves to project defaultAgent CLAUDE
        },
      }),
      prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: '[e2e] codex ticket',
          description: 'codex',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 302,
          ticketKey: `CX-${Date.now()}`,
          updatedAt: daysAgo(2),
          agent: Agent.CODEX,
        },
      }),
    ]);

    await prisma.job.createMany({
      data: [
        {
          ticketId: claudeTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
          updatedAt: daysAgo(4),
          costUsd: 1.0,
        },
        {
          ticketId: codexTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 1.5,
        },
      ],
    });

    const allResult = await makeRequest();
    const allHeat = allResult.body as HeatmapBody;
    expect(allHeat.counters.jobCount).toBe(2);
    expect(allHeat.availableAgents).toEqual(expect.arrayContaining(['CLAUDE', 'CODEX']));

    const claudeResult = await makeRequest('a=CLAUDE');
    const claudeHeat = claudeResult.body as HeatmapBody;
    expect(claudeHeat.counters.jobCount).toBe(1);
    // availableAgents remains stable regardless of filter (computed from unfiltered set)
    expect(claudeHeat.availableAgents).toEqual(expect.arrayContaining(['CLAUDE', 'CODEX']));
  });

  it('SC-007: ticket at SHIP stage with no completed ship job is not counted', async () => {
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] ship stage no ship job',
        description: 'no ship job yet',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 401,
        ticketKey: `SN-${Date.now()}`,
        updatedAt: daysAgo(1),
      },
    });

    const { body } = await makeRequest();
    const heatmap = body as HeatmapBody;
    expect(heatmap.counters.shippedTicketCount).toBe(0);
    for (const cell of heatmap.cells) {
      expect(cell.shippedTickets.length).toBe(0);
    }
  });
});
