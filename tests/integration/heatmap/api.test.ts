import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { HeatmapData } from '@/lib/heatmap/types';

describe('Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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
          ticketNumber: 1,
          ticketKey: 'E2E-1',
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] heatmap ticket 2',
          description: 'heatmap test',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 2,
          ticketKey: 'E2E-2',
          updatedAt: daysAgo(5),
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 1.5,
        },
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
          updatedAt: daysAgo(4),
          costUsd: 0.8,
        },
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.2,
        },
        {
          ticketId: idByKey.get('E2E-2')!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
        },
        // Failed job should NOT appear in counts
        {
          ticketId: idByKey.get('E2E-2')!,
          projectId,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
        },
      ],
    });
  }

  function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  it('returns heatmap data with correct structure', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await ctx.api.get<HeatmapData>('/api/heatmap?year=rolling&agent=all');

    expect(response.status).toBe(200);
    expect(response.data.filters.year).toBe('rolling');
    expect(response.data.filters.agent).toBe('all');
    expect(response.data.summary.totalJobs).toBe(4); // 4 completed jobs, 1 failed excluded
    expect(response.data.summary.ticketsShipped).toBe(1); // Only E2E-1 has completed ship job
    expect(response.data.availableYears).toBeInstanceOf(Array);
    expect(response.data.userCreatedAt).toBeDefined();
  });

  it('aggregates jobs by day correctly', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await ctx.api.get<HeatmapData>('/api/heatmap?year=rolling&agent=all');

    // Day 5 should have 2 jobs (implement + quick-impl)
    const day5Key = toDateKey(daysAgo(5));
    expect(response.data.days[day5Key]?.jobCount).toBe(2);
    expect(response.data.days[day5Key]?.costUsd).toBe(1.5);

    // Day 3 should have the ship job with ticketsShipped
    const day3Key = toDateKey(daysAgo(3));
    expect(response.data.days[day3Key]?.jobCount).toBe(1);
    expect(response.data.days[day3Key]?.ticketsShipped).toContain('E2E-1');
  });

  it('counts shipped tickets by ship job completion only', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await ctx.api.get<HeatmapData>('/api/heatmap?year=rolling&agent=all');

    // E2E-1 has a completed ship job, E2E-2 has no ship job
    expect(response.data.summary.ticketsShipped).toBe(1);
  });

  it('returns empty data when no jobs exist', async () => {
    const response = await ctx.api.get<HeatmapData>('/api/heatmap?year=rolling&agent=all');

    expect(response.status).toBe(200);
    expect(response.data.summary.totalJobs).toBe(0);
    expect(response.data.summary.ticketsShipped).toBe(0);
    expect(Object.keys(response.data.days)).toHaveLength(0);
  });

  it('filters by specific year', async () => {
    await seedHeatmapFixtures(ctx.projectId);
    const currentYear = new Date().getFullYear();

    const response = await ctx.api.get<HeatmapData>(
      `/api/heatmap?year=${currentYear}&agent=all`
    );

    expect(response.status).toBe(200);
    expect(response.data.filters.year).toBe(String(currentYear));
    // All seeded jobs are within the last 5 days so they should be in current year
    expect(response.data.summary.totalJobs).toBe(4);
  });

  it('defaults to rolling year and all agents', async () => {
    const response = await ctx.api.get<HeatmapData>('/api/heatmap');

    expect(response.status).toBe(200);
    expect(response.data.filters.year).toBe('rolling');
    expect(response.data.filters.agent).toBe('all');
  });
});
