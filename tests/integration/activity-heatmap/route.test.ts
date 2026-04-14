import { describe, it, expect, beforeEach } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import type { HeatmapResponse } from '@/lib/activity-heatmap/types';

describe('Activity Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  async function seedHeatmapData(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped ticket 1',
          description: 'heatmap test ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: `HM-${projectId}-1`,
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] build ticket 2',
          description: 'heatmap test ticket',
          stage: Stage.BUILD,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 2,
          ticketKey: `HM-${projectId}-2`,
          updatedAt: daysAgo(5),
          agent: Agent.CODEX,
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get(`HM-${projectId}-1`)!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.50,
        },
        {
          ticketId: idByKey.get(`HM-${projectId}-1`)!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.75,
        },
        {
          ticketId: idByKey.get(`HM-${projectId}-2`)!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.FAILED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: null,
        },
      ],
    });
  }

  describe('GET /api/activity-heatmap', () => {
    it('returns heatmap data for user with jobs', async () => {
      await seedHeatmapData(ctx.projectId);

      const res = await ctx.api.get<HeatmapResponse>('/api/activity-heatmap');

      expect(res.status).toBe(200);
      expect(res.data.days).toBeInstanceOf(Array);
      expect(res.data.days.length).toBeGreaterThanOrEqual(1);
      expect(res.data.totalJobs).toBeGreaterThanOrEqual(3);
      expect(res.data.totalTicketsShipped).toBeGreaterThanOrEqual(1);
      expect(res.data.period).toHaveProperty('start');
      expect(res.data.period).toHaveProperty('end');
      expect(res.data.availableYears).toBeInstanceOf(Array);
      expect(res.data.availableAgents).toBeInstanceOf(Array);
      expect(res.data.availableAgents[0]).toMatchObject({ value: 'all', label: 'All agents' });
    });

    it('returns empty data for user with no jobs', async () => {
      // After cleanup, the project should have no jobs
      const res = await ctx.api.get<HeatmapResponse>('/api/activity-heatmap');

      expect(res.status).toBe(200);
      expect(res.data.days).toEqual([]);
      expect(res.data.totalJobs).toBe(0);
      expect(res.data.totalTicketsShipped).toBe(0);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const unauthClient = createAPIClient({
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      });

      const res = await unauthClient.get('/api/activity-heatmap');

      expect(res.status).toBe(401);
    });

    it('includes jobs from member projects', async () => {
      await seedHeatmapData(ctx.projectId);

      const res = await ctx.api.get<HeatmapResponse>('/api/activity-heatmap');

      // The test user's data should include the seeded project
      expect(res.status).toBe(200);
      expect(res.data.totalJobs).toBeGreaterThanOrEqual(3);
    });

    // US3: Year filter scenarios
    it('filters by specific year correctly', async () => {
      await seedHeatmapData(ctx.projectId);
      const currentYear = new Date().getFullYear();

      const res = await ctx.api.get<HeatmapResponse>(
        `/api/activity-heatmap?year=${currentYear}`
      );

      expect(res.status).toBe(200);
      expect(res.data.period.start).toContain(String(currentYear));
    });

    it('validates invalid year param returns 400', async () => {
      const res = await ctx.api.get('/api/activity-heatmap?year=abc');
      expect(res.status).toBe(400);
    });

    // US4: Agent filter scenarios
    it('filters by agent correctly', async () => {
      await seedHeatmapData(ctx.projectId);

      const res = await ctx.api.get<HeatmapResponse>(
        '/api/activity-heatmap?agent=CLAUDE'
      );

      expect(res.status).toBe(200);
      // Filtered by CLAUDE should still return data (default agent is CLAUDE)
      expect(res.data.totalJobs).toBeGreaterThanOrEqual(1);
    });

    it('validates invalid agent param returns 400', async () => {
      const res = await ctx.api.get('/api/activity-heatmap?agent=INVALID');
      expect(res.status).toBe(400);
    });
  });
});
