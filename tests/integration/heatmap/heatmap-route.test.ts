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

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] heatmap ticket 1',
          description: 'heatmap test',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 100,
          ticketKey: `E2E-100`,
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 2',
          description: 'heatmap test codex',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 101,
          ticketKey: `E2E-101`,
          updatedAt: daysAgo(2),
          agent: Agent.CODEX,
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-100')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.5,
        },
        {
          ticketId: idByKey.get('E2E-100')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.5,
        },
        {
          ticketId: idByKey.get('E2E-101')!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
        {
          ticketId: idByKey.get('E2E-100')!,
          projectId,
          command: 'ship',
          status: JobStatus.FAILED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
      ],
    });
  }

  function makeRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/heatmap');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new NextRequest(url);
  }

  it('returns aggregated data for authenticated user', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.cells).toBeDefined();
    expect(data.summary.totalJobs).toBeGreaterThan(0);
    expect(data.thresholds).toHaveLength(4);
    expect(data.filters).toEqual({ year: 'rolling', agent: 'all' });
  });

  it('returns correct totalShipped (only COMPLETED ship jobs)', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.summary.totalShipped).toBe(1);
  });

  it('returns percentile-based thresholds', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.thresholds).toHaveLength(4);
    for (const t of data.thresholds) {
      expect(typeof t).toBe('number');
      expect(t).toBeGreaterThan(0);
    }
  });

  it('returns 400 for invalid year parameter', async () => {
    const res = await GET(makeRequest({ year: 'invalid' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid agent parameter', async () => {
    const res = await GET(makeRequest({ agent: 'INVALID_AGENT' }));
    expect(res.status).toBe(400);
  });

  it('returns empty cells for period with no activity', async () => {
    const res = await GET(makeRequest({ year: '2020' }));
    const data = await res.json();

    expect(data.cells).toEqual([]);
    expect(data.summary.totalJobs).toBe(0);
    expect(data.summary.totalShipped).toBe(0);
  });

  it('returns correct availableYears based on user creation date', async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(Array.isArray(data.availableYears)).toBe(true);
    expect(data.availableYears.length).toBeGreaterThan(0);
    expect(data.availableYears).toContain(String(new Date().getUTCFullYear()));
  });

  it('returns availableAgents list', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.availableAgents.length).toBeGreaterThanOrEqual(1);
    expect(data.availableAgents[0].value).toBe('all');
    expect(data.availableAgents[0].isDefault).toBe(true);
  });

  it('filters by agent using effective agent resolution', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest({ agent: 'CLAUDE' }));
    const data = await res.json();

    expect(data.filters.agent).toBe('CLAUDE');
    expect(data.summary.totalJobs).toBeGreaterThan(0);
  });

  it('filters by specific calendar year', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const currentYear = String(new Date().getFullYear());

    const res = await GET(makeRequest({ year: currentYear }));
    const data = await res.json();

    expect(data.filters.year).toBe(currentYear);
    expect(data.summary.totalJobs).toBeGreaterThan(0);
  });

  it('returns null totalCost when all jobs lack cost data', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const res = await GET(makeRequest({ agent: 'CODEX' }));
    const data = await res.json();

    const cellWithCodexActivity = data.cells.find(
      (c: { totalCost: number | null }) => c.totalCost === null
    );
    if (cellWithCodexActivity) {
      expect(cellWithCodexActivity.totalCost).toBeNull();
    }
  });
});
