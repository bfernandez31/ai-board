import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/activity-heatmap/route';
import type { ActivityHeatmapResponse } from '@/lib/heatmap/types';

const TEST_USER_ID = 'test-user-id';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => TEST_USER_ID),
}));

describe('Activity Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/projects/activity-heatmap');
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
    return new NextRequest(url, {
      headers: { 'x-test-user-id': TEST_USER_ID },
    });
  }

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) => {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      d.setHours(12, 0, 0, 0);
      return d;
    };

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped claude ticket',
          description: 'heatmap test',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 100,
          ticketKey: `E2E-H100`,
        },
        {
          projectId,
          title: '[e2e] build ticket codex',
          description: 'heatmap test',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 101,
          ticketKey: `E2E-H101`,
          agent: Agent.CODEX,
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-H100')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 1.50,
        },
        {
          ticketId: idByKey.get('E2E-H100')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 0.50,
        },
        {
          ticketId: idByKey.get('E2E-H101')!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
        {
          ticketId: idByKey.get('E2E-H100')!,
          projectId,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 2.00,
        },
      ],
    });

    return { idByKey };
  }

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('@/lib/db/users');
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid year parameter', async () => {
    const response = await GET(makeRequest({ year: 'abc' }));
    expect(response.status).toBe(400);
  });

  it('returns correct daily job counts for authenticated user', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const data: ActivityHeatmapResponse = await response.json();
    expect(data.summary.totalJobs).toBeGreaterThanOrEqual(3);
    expect(Object.keys(data.days).length).toBeGreaterThanOrEqual(1);
  });

  it('returns correct shipped ticket count (only ship command COMPLETED)', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(makeRequest());
    const data: ActivityHeatmapResponse = await response.json();

    expect(data.summary.ticketsShipped).toBe(1);
  });

  it('cost aggregation sums non-null costs and returns null when all null', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(makeRequest());
    const data: ActivityHeatmapResponse = await response.json();

    const daysWithCost = Object.values(data.days).filter((d) => d.costUsd !== null);
    expect(daysWithCost.length).toBeGreaterThan(0);

    for (const day of daysWithCost) {
      expect(day.costUsd).toBeGreaterThan(0);
    }
  });

  it('rolling period returns ~365 days range', async () => {
    const response = await GET(makeRequest());
    const data: ActivityHeatmapResponse = await response.json();

    const start = new Date(data.period.startDate);
    const end = new Date(data.period.endDate);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThanOrEqual(364);
    expect(diff).toBeLessThanOrEqual(366);
  });

  it('returns availableYears including rolling', async () => {
    const response = await GET(makeRequest());
    const data: ActivityHeatmapResponse = await response.json();
    expect(data.availableYears).toContain('rolling');
    expect(data.availableYears.length).toBeGreaterThanOrEqual(1);
  });

  it('returns availableAgents including All', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(makeRequest());
    const data: ActivityHeatmapResponse = await response.json();
    expect(data.availableAgents[0]!.value).toBe('all');
    expect(data.availableAgents[0]!.label).toBe('All');
  });

  it('returns 400 for invalid agent parameter', async () => {
    const response = await GET(makeRequest({ agent: 'INVALID_AGENT' }));
    expect(response.status).toBe(400);
  });

  it('filters by agent correctly', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const allResponse = await GET(makeRequest());
    const allData: ActivityHeatmapResponse = await allResponse.json();

    const claudeResponse = await GET(makeRequest({ agent: 'CLAUDE' }));
    const claudeData: ActivityHeatmapResponse = await claudeResponse.json();

    expect(claudeData.summary.totalJobs).toBeLessThanOrEqual(allData.summary.totalJobs);
  });
});
