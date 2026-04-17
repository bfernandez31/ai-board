import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

import { GET } from '@/app/api/heatmap/route';

describe('GET /api/heatmap', () => {
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
          title: '[e2e] heatmap default claude',
          description: 'claude ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-HM1',
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] heatmap codex ticket',
          description: 'codex ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'E2E-HM2',
          updatedAt: daysAgo(2),
          agent: Agent.CODEX,
        },
      ],
    });

    const idByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-HM1')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 1.25,
        },
        {
          ticketId: idByKey.get('E2E-HM1')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.5,
        },
        {
          ticketId: idByKey.get('E2E-HM2')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
        {
          ticketId: idByKey.get('E2E-HM2')!,
          projectId,
          command: 'ship',
          status: JobStatus.FAILED, // failed ship job does NOT count as shipped
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
        },
      ],
    });
  }

  it('returns per-day totals, headline counts, and filter options for the authenticated user', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(new NextRequest('http://localhost/api/heatmap'));
    const body = (await response.json()) as {
      totalJobs: number;
      totalShipped: number;
      days: Array<{ date: string; jobCount: number; totalCost: number | null; ticketsShipped: number }>;
      filters: { period: string; agent: string };
      agentOptions: Array<{ value: string; label: string }>;
      periodOptions: Array<{ value: string; label: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ period: 'last-12-months', agent: 'all' });
    expect(body.totalJobs).toBe(4); // all 4 jobs have completedAt in range (incl. the failed ship)
    // totalShipped only counts COMPLETED `ship` jobs
    expect(body.totalShipped).toBe(1);

    // Agent options should list the user's effective agents (CLAUDE + CODEX)
    expect(body.agentOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'all' }),
        expect.objectContaining({ value: 'CLAUDE' }),
        expect.objectContaining({ value: 'CODEX' }),
      ])
    );

    // The rolling year spans 365 days
    expect(body.days.length).toBe(365);

    const dayWithBothJobs = body.days.find((day) => day.jobCount > 0 && day.totalCost != null);
    expect(dayWithBothJobs).toBeDefined();
  });

  it('filters activity by effective agent, including null-agent tickets on a matching-default project', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest('http://localhost/api/heatmap?agent=CLAUDE')
    );
    const response = (await responseRaw.json()) as {
      filters: { agent: string };
      totalJobs: number;
      totalShipped: number;
    };

    expect(responseRaw.status).toBe(200);
    expect(response.filters.agent).toBe('CLAUDE');
    // E2E-HM1 (agent=null, project default CLAUDE) contributes 2 jobs, 1 shipped.
    expect(response.totalJobs).toBe(2);
    expect(response.totalShipped).toBe(1);
  });

  it('falls back to "all" when the requested agent has no jobs for this user', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest('http://localhost/api/heatmap?agent=GEMINI')
    );
    const response = (await responseRaw.json()) as {
      totalJobs: number;
      filters: { agent: string };
    };

    expect(responseRaw.status).toBe(200);
    expect(response.filters.agent).toBe('all');
    expect(response.totalJobs).toBe(4);
  });

  it('rejects invalid period and agent values by falling back to defaults', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest('http://localhost/api/heatmap?period=banana&agent=BADAGENT')
    );
    const response = (await responseRaw.json()) as { filters: { period: string; agent: string } };

    expect(responseRaw.status).toBe(200);
    expect(response.filters).toEqual({ period: 'last-12-months', agent: 'all' });
  });
});
