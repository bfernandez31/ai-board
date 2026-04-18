import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/heatmap/route';
import type { HeatmapData } from '@/lib/heatmap/types';

const TEST_USER_ID = 'test-user-id';

vi.mock('@/lib/db/users', () => ({
  getCurrentUser: vi.fn(async () => ({
    id: TEST_USER_ID,
    email: 'test@e2e.local',
    name: 'Test User',
    source: 'test-override' as const,
  })),
  requireAuth: vi.fn(async () => TEST_USER_ID),
}));

describe('Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function createRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/heatmap');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new NextRequest(url, {
      headers: { 'x-test-user-id': TEST_USER_ID },
    });
  }

  async function seedHeatmapData(projectId: number) {
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] heatmap ticket 1',
          description: 'test',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 100,
          ticketKey: 'E2E-100',
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 2',
          description: 'test',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 101,
          ticketKey: 'E2E-101',
          updatedAt: daysAgo(1),
        },
      ],
    });

    const ticket1 = tickets[0]!;
    const ticket2 = tickets[1]!;

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket1.id,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.50,
        },
        {
          ticketId: ticket1.id,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.10,
        },
        {
          ticketId: ticket2.id,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: null,
        },
        {
          ticketId: ticket2.id,
          projectId,
          command: 'specify',
          status: JobStatus.FAILED,
          startedAt: daysAgo(10),
          completedAt: daysAgo(10),
          updatedAt: daysAgo(10),
        },
      ],
    });
  }

  it('returns heatmap data for default period', async () => {
    await seedHeatmapData(ctx.projectId);
    const response = await GET(createRequest());
    expect(response.status).toBe(200);

    const data = (await response.json()) as HeatmapData;
    expect(data.totalJobs).toBe(3);
    expect(data.totalShipped).toBe(1);
    expect(data.filters.period).toBe('last-12-months');
    expect(data.filters.agent).toBe('all');
  });

  it('counts shipped tickets from ship jobs only', async () => {
    await seedHeatmapData(ctx.projectId);
    const response = await GET(createRequest());
    const data = (await response.json()) as HeatmapData;

    expect(data.totalShipped).toBe(1);

    const daysWithShipped = Object.values(data.days).filter(
      (d) => d.shippedTickets.length > 0
    );
    expect(daysWithShipped.length).toBe(1);
    expect(daysWithShipped[0]!.shippedTickets[0]).toContain('E2E-100');
  });

  it('returns cost data where available, null otherwise', async () => {
    await seedHeatmapData(ctx.projectId);
    const response = await GET(createRequest());
    const data = (await response.json()) as HeatmapData;

    const allDays = Object.values(data.days);
    const daysWithCost = allDays.filter((d) => d.costUsd != null);
    expect(daysWithCost.length).toBeGreaterThan(0);
  });

  it('excludes failed jobs from counts', async () => {
    await seedHeatmapData(ctx.projectId);
    const response = await GET(createRequest());
    const data = (await response.json()) as HeatmapData;

    expect(data.totalJobs).toBe(3);
  });

  it('returns empty data when no jobs', async () => {
    const response = await GET(createRequest());
    const data = (await response.json()) as HeatmapData;

    expect(data.totalJobs).toBe(0);
    expect(data.totalShipped).toBe(0);
    expect(Object.keys(data.days)).toHaveLength(0);
  });

  it('rejects invalid period', async () => {
    const response = await GET(createRequest({ period: 'invalid' }));
    expect(response.status).toBe(400);
  });

  it('rejects invalid agent', async () => {
    const response = await GET(createRequest({ agent: 'INVALID' }));
    expect(response.status).toBe(400);
  });

  it('filters by year period', async () => {
    await seedHeatmapData(ctx.projectId);
    const year = String(new Date().getFullYear());
    const response = await GET(createRequest({ period: year }));
    const data = (await response.json()) as HeatmapData;

    expect(data.filters.period).toBe(year);
    expect(data.periodStart).toBe(`${year}-01-01`);
    expect(data.periodEnd).toBe(`${year}-12-31`);
  });

  it('includes userCreatedAt in response', async () => {
    const response = await GET(createRequest());
    const data = (await response.json()) as HeatmapData;

    expect(data.userCreatedAt).toBeDefined();
    expect(new Date(data.userCreatedAt).getTime()).not.toBeNaN();
  });
});
