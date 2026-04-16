import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const requireAuthMock = vi.fn<(...args: unknown[]) => Promise<string>>(
  async () => 'test-user-id'
);

vi.mock('@/lib/db/users', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
  getCurrentUser: vi.fn(),
  getCurrentUserOrNull: vi.fn(),
  getCurrentUserOrToken: vi.fn(),
  deleteUserAccount: vi.fn(),
  getTestUserOverrideResolution: vi.fn(),
  logBlockedTestUserOverrideAttempt: vi.fn(),
  StripeCleanupError: class extends Error {},
}));

import { GET } from '@/app/api/heatmap/route';

const prisma = getPrismaClient();
const TEST_USER_ID = 'test-user-id';

interface HeatmapResponse {
  filters: { period: string; agent: string };
  periodOptions: Array<{ value: string; label: string; isDefault: boolean }>;
  availableAgents: Array<{ value: string; label: string; jobCount: number }>;
  days: Array<{
    date: string;
    inPeriod: boolean;
    jobCount: number;
    shippedTicketCount: number;
    totalCost: number | null;
    intensityLevel: number;
  }>;
  totals: { jobCount: number; shippedTicketCount: number };
  intensityThresholds: [number, number, number, number];
  generatedAt: string;
}

async function setUserCreatedAt(userId: string, createdAt: Date) {
  await prisma.user.update({
    where: { id: userId },
    data: { createdAt, updatedAt: new Date() },
  });
}

function buildRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/heatmap${query ? `?${query}` : ''}`);
}

async function readPayload(response: Response): Promise<HeatmapResponse> {
  return (await response.json()) as HeatmapResponse;
}

async function seedJobsOnDay(
  projectId: number,
  ticketId: number,
  when: Date,
  overrides: Array<Partial<{
    command: string;
    status: JobStatus;
    costUsd: number | null;
  }>> = [{ command: 'implement', status: JobStatus.COMPLETED, costUsd: 0.1 }]
) {
  await prisma.job.createMany({
    data: overrides.map((o) => ({
      ticketId,
      projectId,
      command: o.command ?? 'implement',
      status: o.status ?? JobStatus.COMPLETED,
      startedAt: when,
      completedAt: when,
      updatedAt: when,
      costUsd: o.costUsd ?? null,
    })),
  });
}

describe('Heatmap route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await setUserCreatedAt(TEST_USER_ID, new Date(2023, 0, 1));
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
    requireAuthMock.mockResolvedValue(TEST_USER_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAuthMock.mockRejectedValueOnce(new Error('Unauthorized'));
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it('default call returns last-12-months filters and >=365 in-period days', async () => {
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const data = await readPayload(response);
    expect(data.filters.period).toBe('last-12-months');
    expect(data.filters.agent).toBe('all');
    const inPeriod = data.days.filter((d) => d.inPeriod);
    expect(inPeriod.length).toBeGreaterThanOrEqual(365);
    expect(data.days[0]!.date.slice(-2)).toMatch(/\d{2}/);
  });

  it('silently coerces invalid period and agent filters', async () => {
    const response = await GET(buildRequest('period=foo&agent=unknown'));
    const data = await readPayload(response);
    expect(response.status).toBe(200);
    expect(data.filters.period).toBe('last-12-months');
    expect(data.filters.agent).toBe('all');
  });

  it('silently falls back when period year is before account creation', async () => {
    await setUserCreatedAt(TEST_USER_ID, new Date(2024, 5, 1));
    const response = await GET(buildRequest('period=2019'));
    const data = await readPayload(response);
    expect(data.filters.period).toBe('last-12-months');
  });

  it('specific year resolves to grid starting on the Sunday on/before Jan 1', async () => {
    const response = await GET(buildRequest('period=2024'));
    const data = await readPayload(response);
    expect(data.filters.period).toBe('2024');
    const firstInPeriod = data.days.find((d) => d.inPeriod);
    expect(firstInPeriod?.date).toBe('2024-01-01');
    const inPeriod = data.days.filter((d) => d.inPeriod);
    expect(inPeriod).toHaveLength(366);
    const gridStart = new Date(data.days[0]!.date);
    expect(gridStart.getUTCDay()).toBe(0);
  });

  it('ship-FAILED jobs are excluded from shippedTicketCount', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] ship failed',
        description: 'ship failed',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 900,
        ticketKey: `${ctx.projectId}-HMAPR-900`,
        updatedAt: new Date(),
      },
    });
    const day = new Date();
    day.setHours(10, 0, 0, 0);
    await seedJobsOnDay(ctx.projectId, ticket.id, day, [
      { command: 'ship', status: JobStatus.FAILED },
    ]);
    const response = await GET(buildRequest());
    const data = await readPayload(response);
    expect(data.totals.shippedTicketCount).toBe(0);
    expect(data.totals.jobCount).toBe(1);
  });

  it('cost nullability: day with all null costs returns totalCost=null; mixed returns sum', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] cost route',
        description: 'cost route',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 901,
        ticketKey: `${ctx.projectId}-HMAPR-901`,
        updatedAt: new Date(),
      },
    });
    const mixedDay = new Date();
    mixedDay.setHours(9, 0, 0, 0);
    await seedJobsOnDay(ctx.projectId, ticket.id, mixedDay, [
      { command: 'implement', status: JobStatus.COMPLETED, costUsd: 0.1 },
      { command: 'implement', status: JobStatus.COMPLETED, costUsd: null },
    ]);
    const nullDay = new Date(mixedDay.getTime() - 24 * 60 * 60 * 1000);
    await seedJobsOnDay(ctx.projectId, ticket.id, nullDay, [
      { command: 'verify', status: JobStatus.COMPLETED, costUsd: null },
    ]);

    const response = await GET(buildRequest());
    const data = await readPayload(response);

    const keyFor = (d: Date) =>
      [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
    const mixedCell = data.days.find((d) => d.date === keyFor(mixedDay));
    const nullCell = data.days.find((d) => d.date === keyFor(nullDay));
    expect(mixedCell?.totalCost).toBeCloseTo(0.1, 5);
    expect(nullCell?.totalCost).toBeNull();
  });

  it('empty user returns availableAgents=[] and all cells intensityLevel 0', async () => {
    const response = await GET(buildRequest());
    const data = await readPayload(response);
    expect(data.availableAgents).toEqual([]);
    for (const cell of data.days) {
      expect(cell.intensityLevel).toBe(0);
    }
    expect(data.totals.jobCount).toBe(0);
  });

  it('single-agent user returns availableAgents=[] to hide the filter', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] single agent',
        description: 'single agent',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 902,
        ticketKey: `${ctx.projectId}-HMAPR-902`,
        updatedAt: new Date(),
        agent: Agent.CLAUDE,
      },
    });
    const when = new Date();
    when.setHours(12, 0, 0, 0);
    await seedJobsOnDay(ctx.projectId, ticket.id, when);
    const response = await GET(buildRequest());
    const data = await readPayload(response);
    expect(data.availableAgents).toEqual([]);
  });

  it('agent filter narrows totals while keeping grid boundaries stable', async () => {
    const claudeTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] agent filter claude',
        description: 'claude',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 903,
        ticketKey: `${ctx.projectId}-HMAPR-903`,
        updatedAt: new Date(),
        agent: Agent.CLAUDE,
      },
    });
    const codexTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] agent filter codex',
        description: 'codex',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 904,
        ticketKey: `${ctx.projectId}-HMAPR-904`,
        updatedAt: new Date(),
        agent: Agent.CODEX,
      },
    });
    const when = new Date();
    when.setHours(12, 0, 0, 0);
    await seedJobsOnDay(ctx.projectId, claudeTicket.id, when);
    await seedJobsOnDay(ctx.projectId, codexTicket.id, when);

    const unfilteredResponse = await GET(buildRequest());
    const claudeResponse = await GET(buildRequest('agent=CLAUDE'));
    const unfiltered = await readPayload(unfilteredResponse);
    const claude = await readPayload(claudeResponse);

    expect(unfiltered.totals.jobCount).toBe(2);
    expect(claude.totals.jobCount).toBe(1);
    expect(claude.days.length).toBe(unfiltered.days.length);
    expect(claude.days[0]!.date).toBe(unfiltered.days[0]!.date);
    expect(claude.availableAgents.map((a) => a.value).sort()).toEqual(['CLAUDE', 'CODEX']);
  });
});
