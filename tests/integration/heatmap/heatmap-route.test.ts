import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/heatmap/route';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

describe('Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] heatmap ticket 1',
          description: 'heatmap test',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 100,
          ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE' + ctx.projectId}-100`,
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 2',
          description: 'heatmap test codex',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 101,
          ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE' + ctx.projectId}-101`,
          agent: Agent.CODEX,
        },
      ],
    });

    // Jobs for ticket 1 (CLAUDE default)
    await prisma.job.createMany({
      data: [
        {
          ticketId: tickets[0].id,
          projectId,
          command: 'specify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          costUsd: 1.50,
          updatedAt: daysAgo(5),
        },
        {
          ticketId: tickets[0].id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          costUsd: 2.00,
          updatedAt: daysAgo(3),
        },
        {
          ticketId: tickets[0].id,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          costUsd: 0.50,
          updatedAt: daysAgo(2),
        },
      ],
    });

    // Jobs for ticket 2 (CODEX)
    await prisma.job.createMany({
      data: [
        {
          ticketId: tickets[1].id,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          costUsd: 3.00,
          updatedAt: daysAgo(3),
        },
        {
          ticketId: tickets[1].id,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          costUsd: 0.75,
          updatedAt: daysAgo(1),
        },
      ],
    });

    return tickets;
  }

  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost:3000/api/heatmap');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new NextRequest(url);
  }

  it('returns heatmap data with correct response shape', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('cells');
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('filters');
    expect(data).toHaveProperty('availableYears');
    expect(data).toHaveProperty('availableAgents');
    expect(data.filters).toEqual({ year: 'rolling', agent: 'all' });
  });

  it('aggregates daily job counts and costs correctly', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest());
    const data = await response.json();

    // Day 3 ago: implement + quick-impl = 2 jobs, $5.00
    const day3Key = daysAgo(3).toISOString().slice(0, 10);
    const day3Cell = data.cells.find((c: { date: string }) => c.date === day3Key);
    expect(day3Cell).toBeDefined();
    expect(day3Cell.jobCount).toBe(2);
    expect(day3Cell.costUsd).toBeCloseTo(5.00, 1);
  });

  it('counts shipped tickets correctly', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest());
    const data = await response.json();

    // Day 2 ago: ship ticket 1
    const day2Key = daysAgo(2).toISOString().slice(0, 10);
    const day2Cell = data.cells.find((c: { date: string }) => c.date === day2Key);
    expect(day2Cell).toBeDefined();
    expect(day2Cell.ticketsShipped).toBe(1);

    // Summary should total 2 shipped tickets
    expect(data.summary.totalTicketsShipped).toBe(2);
    expect(data.summary.totalJobs).toBe(5);
  });

  it('returns empty state when no jobs exist', async () => {
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.cells).toEqual([]);
    expect(data.summary.totalJobs).toBe(0);
    expect(data.summary.totalTicketsShipped).toBe(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/db/users');
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('filters by specific year', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest({ year: String(now.getFullYear()) }));
    const data = await response.json();
    expect(data.filters.year).toBe(now.getFullYear());
    expect(data.cells.length).toBeGreaterThan(0);
  });

  it('returns empty for year with no data', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest({ year: '2020' }));
    const data = await response.json();
    expect(data.cells).toEqual([]);
  });

  it('filters by agent', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const response = await GET(makeRequest({ agent: 'CODEX' }));
    const data = await response.json();
    expect(data.filters.agent).toBe('CODEX');

    // Only ticket 2 (CODEX) jobs should appear: quick-impl + ship
    expect(data.summary.totalJobs).toBe(2);
  });

  it('returns 400 for invalid parameters', async () => {
    const response = await GET(makeRequest({ year: 'invalid' }));
    expect(response.status).toBe(400);
  });
});
