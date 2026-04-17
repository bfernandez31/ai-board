import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/user/activity-heatmap/route';
import { requireAuth } from '@/lib/db/users';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(),
}));

describe('Activity Heatmap Route', () => {
  let ctx: TestContext;
  let userId: string;
  let projectId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    const uniqueEmail = `heatmap-user-${ctx.projectId}-${Date.now()}@project${ctx.projectId}.e2e.test`;
    const user = await prisma.user.create({
      data: {
        id: `heatmap-user-${ctx.projectId}-${Date.now()}`,
        email: uniqueEmail,
        name: 'Heatmap Test User',
        emailVerified: new Date(),
        createdAt: new Date(2024, 2, 15),
        updatedAt: new Date(),
      },
    });
    userId = user.id;

    const project = await prisma.project.create({
      data: {
        name: '[e2e] Heatmap Project',
        description: 'Heatmap integration test project',
        githubOwner: 'test',
        githubRepo: `heatmap-${ctx.projectId}-${Date.now()}`,
        key: `HM${String(ctx.projectId).padStart(1, '0')}`.slice(0, 6),
        userId: user.id,
        defaultAgent: Agent.CLAUDE,
        clarificationPolicy: 'AUTO',
        updatedAt: new Date(),
      },
    });
    projectId = project.id;

    vi.mocked(requireAuth).mockImplementation(async () => userId);
  });

  async function seedJobsWithDays(dayOffsets: Array<{
    offset: number;
    command: string;
    costUsd: number | null;
    agent?: Agent;
  }>) {
    const now = new Date();
    const tickets = new Map<string, number>();

    for (let i = 0; i < dayOffsets.length; i += 1) {
      const { agent } = dayOffsets[i]!;
      const ticketKey = `HM-${i + 1}`;
      const ticket = await prisma.ticket.create({
        data: {
          projectId,
          title: `[e2e] Heatmap ticket ${i + 1}`,
          description: 'heatmap test',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: i + 1,
          ticketKey,
          agent: agent ?? null,
          updatedAt: new Date(),
        },
      });
      tickets.set(ticketKey, ticket.id);
    }

    const jobs = dayOffsets.map((entry, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - entry.offset);
      return {
        ticketId: tickets.get(`HM-${i + 1}`)!,
        projectId,
        command: entry.command,
        status: JobStatus.COMPLETED,
        startedAt: date,
        completedAt: date,
        updatedAt: date,
        costUsd: entry.costUsd,
      };
    });
    await prisma.job.createMany({ data: jobs });
  }

  it('returns an empty dataset with default filters when the user has no jobs', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap')
    );
    const body = (await response.json()) as {
      filters: { period: string; agent: string };
      days: unknown[];
      totalJobs: number;
      totalTicketsShipped: number;
      availableAgents: Array<{ value: string }>;
      availablePeriods: Array<{ value: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ period: 'last-12-months', agent: 'all' });
    expect(body.days).toEqual([]);
    expect(body.totalJobs).toBe(0);
    expect(body.totalTicketsShipped).toBe(0);
    expect(body.availableAgents.map((a) => a.value)).toEqual(['all']);
    expect(body.availablePeriods[0]?.value).toBe('last-12-months');
  });

  it('aggregates jobs by day and counts shipped tickets by completed ship jobs', async () => {
    await seedJobsWithDays([
      { offset: 3, command: 'implement', costUsd: 1.5 },
      { offset: 3, command: 'verify', costUsd: 0.25 },
      { offset: 3, command: 'ship', costUsd: 0.1 },
      { offset: 10, command: 'ship', costUsd: null },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap')
    );
    const body = (await response.json()) as {
      totalJobs: number;
      totalTicketsShipped: number;
      days: Array<{ date: string; jobCount: number; totalCost: number | null; ticketsShipped: number }>;
    };

    expect(response.status).toBe(200);
    expect(body.totalJobs).toBe(4);
    expect(body.totalTicketsShipped).toBe(2);

    const dayMinus3 = body.days.find((d) => d.jobCount === 3);
    expect(dayMinus3).toBeDefined();
    expect(dayMinus3!.ticketsShipped).toBe(1);
    expect(dayMinus3!.totalCost).toBeCloseTo(1.85, 2);

    const dayMinus10 = body.days.find((d) => d.jobCount === 1);
    expect(dayMinus10).toBeDefined();
    expect(dayMinus10!.totalCost).toBeNull();
    expect(dayMinus10!.ticketsShipped).toBe(1);
  });

  it('filters by effective agent honoring project.defaultAgent', async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
    await seedJobsWithDays([
      { offset: 5, command: 'implement', costUsd: 1.0 },
      { offset: 5, command: 'implement', costUsd: 2.0, agent: Agent.CODEX },
    ]);

    const claudeResponse = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap?agent=CLAUDE')
    );
    const claude = (await claudeResponse.json()) as { totalJobs: number };
    expect(claudeResponse.status).toBe(200);
    expect(claude.totalJobs).toBe(1);

    const codexResponse = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap?agent=CODEX')
    );
    const codex = (await codexResponse.json()) as { totalJobs: number };
    expect(codexResponse.status).toBe(200);
    expect(codex.totalJobs).toBe(1);
  });

  it('rejects invalid period values', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap?period=bogus')
    );
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid activity heatmap filters');
  });

  it('returns 401 when the user is not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity-heatmap')
    );
    expect(response.status).toBe(401);
  });
});
