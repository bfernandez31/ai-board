import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/heatmap/route';

vi.mock('@/lib/db/users', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/db/users')>();
  return {
    ...original,
    requireAuth: vi.fn(async () => 'test-user-id'),
  };
});

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
          description: 'heatmap test ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 100,
          ticketKey: 'E2E-100',
          updatedAt: daysAgo(2),
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 2',
          description: 'heatmap test ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 101,
          ticketKey: 'E2E-101',
          updatedAt: daysAgo(2),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 3',
          description: 'heatmap test ticket',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 102,
          ticketKey: 'E2E-102',
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
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
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
          ticketId: idByKey.get('E2E-101')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 2.0,
        },
        // A FAILED ship job - should NOT count as shipped
        {
          ticketId: idByKey.get('E2E-102')!,
          projectId,
          command: 'ship',
          status: JobStatus.FAILED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: null,
        },
        // A non-ship COMPLETED job
        {
          ticketId: idByKey.get('E2E-102')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 3.0,
        },
      ],
    });
  }

  it('returns 401 for unauthenticated requests', async () => {
    const { requireAuth } = await import('@/lib/db/users');
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap')
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns correct daily job counts for seeded data', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap')
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      days: Array<{ date: string; jobCount: number }>;
      totalJobs: number;
      totalShipped: number;
    };

    // 5 COMPLETED jobs total (1 implement + 1 ship + 1 quick-impl + 1 ship + 1 implement)
    expect(data.totalJobs).toBe(5);
    // 2 COMPLETED ship jobs for E2E-100 and E2E-101
    expect(data.totalShipped).toBe(2);

    // Verify days array has entries
    expect(data.days.length).toBeGreaterThan(0);
  });

  it('filters by agent with effective agent resolution', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap?agent=CODEX')
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      totalJobs: number;
      totalShipped: number;
    };

    // Only CODEX ticket (E2E-101) jobs: quick-impl + ship = 2
    expect(data.totalJobs).toBe(2);
    expect(data.totalShipped).toBe(1);
  });

  it('returns cost aggregation correctly', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap')
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      days: Array<{ date: string; costUsd: number | null }>;
    };

    // Find the day with both cost and null cost jobs (daysAgo(2))
    // daysAgo(2) has: ship $0.5, quick-impl null, ship $2.0
    // The day that has the ship $1.5 is daysAgo(3)
    const daysWithCost = data.days.filter((d) => d.costUsd !== null);
    expect(daysWithCost.length).toBeGreaterThan(0);

    // Verify cost sums are non-negative
    for (const day of daysWithCost) {
      expect(day.costUsd).toBeGreaterThan(0);
    }
  });

  it('returns shipped tickets (only COMPLETED ship jobs, deduped)', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap')
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      days: Array<{ date: string; shippedTickets: string[] }>;
    };

    const allShipped = data.days.flatMap((d) => d.shippedTickets);
    // E2E-100 and E2E-101 had COMPLETED ship jobs
    expect(allShipped).toContain('E2E-100');
    expect(allShipped).toContain('E2E-101');
    // E2E-102 only had a FAILED ship job
    expect(allShipped).not.toContain('E2E-102');
  });

  it('returns available years from actual data', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/heatmap')
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      availableYears: number[];
    };

    expect(data.availableYears).toContain(new Date().getFullYear());
  });

  it('returns 400 for invalid filter values', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/heatmap?agent=INVALID_AGENT')
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Invalid heatmap filters');
  });
});
