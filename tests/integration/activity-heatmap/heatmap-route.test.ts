import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

let currentUserId = 'test-user-id';

vi.mock('@/lib/db/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/users')>();
  return {
    ...actual,
    requireAuth: vi.fn(async () => currentUserId),
  };
});

// Import after mock so the route binds to the mocked requireAuth.
const { GET } = await import('@/app/api/activity-heatmap/route');

describe('Activity Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    currentUserId = 'test-user-id';
  });

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] heatmap claude shipped',
          description: 'heatmap shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'HEAT-1',
          updatedAt: daysAgo(2),
        },
        {
          projectId,
          title: '[e2e] heatmap codex work',
          description: 'heatmap codex ticket',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'HEAT-2',
          updatedAt: daysAgo(5),
          agent: Agent.CODEX,
        },
      ],
    });
    const byKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: byKey.get('HEAT-1')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.25,
        },
        {
          ticketId: byKey.get('HEAT-1')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 0.15,
        },
        {
          ticketId: byKey.get('HEAT-2')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
          updatedAt: daysAgo(4),
          // intentionally no costUsd — exercises tooltip "omit cost" path
        },
      ],
    });
  }

  it('returns heatmap data with totals, days, and agent options', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(new NextRequest('http://localhost/api/activity-heatmap'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totals.jobCount).toBe(3);
    expect(body.totals.ticketsShipped).toBe(1); // one `ship` job
    expect(body.days.length).toBeGreaterThanOrEqual(2);
    expect(body.filters).toEqual({ period: 'last12', agent: 'all' });

    const agentValues = body.availableAgents.map((o: { value: string }) => o.value);
    expect(agentValues).toContain('all');
    expect(agentValues).toContain('CLAUDE');
    expect(agentValues).toContain('CODEX');
  });

  it('applies effective agent resolution when filtering by agent', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    // Filtering by CLAUDE should include HEAT-1 (ticket.agent null, project defaultAgent CLAUDE)
    const claudeResponse = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=CLAUDE')
    );
    const claude = await claudeResponse.json();
    expect(claudeResponse.status).toBe(200);
    expect(claude.filters.agent).toBe('CLAUDE');
    expect(claude.totals.jobCount).toBe(2); // HEAT-1 implement + ship
    expect(claude.totals.ticketsShipped).toBe(1);

    // Filtering by CODEX should include only HEAT-2 (explicit agent)
    const codexResponse = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=CODEX')
    );
    const codex = await codexResponse.json();
    expect(codex.totals.jobCount).toBe(1);
    expect(codex.totals.ticketsShipped).toBe(0);
  });

  it('rejects invalid period and agent query params', async () => {
    const invalidPeriod = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?period=foo')
    );
    expect(invalidPeriod.status).toBe(400);

    const invalidAgent = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=UNKNOWN')
    );
    expect(invalidAgent.status).toBe(400);
  });

  it('omits totalCost when a day has no recorded cost', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=CODEX')
    );
    const body = await response.json();
    expect(body.totals.jobCount).toBe(1);
    const day = body.days[0];
    expect(day.jobCount).toBe(1);
    expect(day.totalCost).toBeNull();
  });
});
