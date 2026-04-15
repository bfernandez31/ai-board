import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

import { GET } from '@/app/api/projects/activity/route';

describe('Projects Activity Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedProjectsActivityFixtures(): Promise<{ secondaryProjectId: number }> {
    await prisma.user.update({
      where: { id: 'test-user-id' },
      data: {
        createdAt: new Date('2024-05-20T00:00:00.000Z'),
      },
    });

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        defaultAgent: Agent.CODEX,
      },
    });

    const secondaryProject = await prisma.project.create({
      data: {
        name: '[e2e] Activity Project Two',
        description: 'Secondary project for projects activity tests',
        githubOwner: 'test-owner',
        githubRepo: `activity-two-${Date.now()}`,
        key: 'AC2',
        userId: 'test-user-id',
        defaultAgent: Agent.CLAUDE,
        updatedAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId: ctx.projectId,
          title: '[e2e] inherited codex shipped',
          description: 'uses project default agent',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-101',
          updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        },
        {
          projectId: ctx.projectId,
          title: '[e2e] stage only ship ticket',
          description: 'should not count as shipped without ship job',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'E2E-102',
          updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        },
        {
          projectId: secondaryProject.id,
          title: '[e2e] claude shipped',
          description: 'explicit claude project',
          stage: Stage.CLOSED,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1,
          ticketKey: 'AC2-1',
          updatedAt: new Date('2026-03-15T00:00:00.000Z'),
          closedAt: new Date('2026-03-15T00:00:00.000Z'),
        },
      ],
    });

    const ticketIdByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticketIdByKey.get('E2E-101')!,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-12T08:00:00.000Z'),
          completedAt: new Date('2026-04-12T09:00:00.000Z'),
          updatedAt: new Date('2026-04-12T09:00:00.000Z'),
          costUsd: 2.75,
        },
        {
          ticketId: ticketIdByKey.get('E2E-101')!,
          projectId: ctx.projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-12T10:00:00.000Z'),
          completedAt: new Date('2026-04-12T11:00:00.000Z'),
          updatedAt: new Date('2026-04-12T11:00:00.000Z'),
          costUsd: null,
        },
        {
          ticketId: ticketIdByKey.get('E2E-102')!,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.FAILED,
          startedAt: new Date('2026-04-11T08:00:00.000Z'),
          completedAt: new Date('2026-04-11T09:00:00.000Z'),
          updatedAt: new Date('2026-04-11T09:00:00.000Z'),
          costUsd: 1.25,
        },
        {
          ticketId: ticketIdByKey.get('AC2-1')!,
          projectId: secondaryProject.id,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-03-15T08:00:00.000Z'),
          completedAt: new Date('2026-03-15T09:00:00.000Z'),
          updatedAt: new Date('2026-03-15T09:00:00.000Z'),
          costUsd: 4.5,
        },
      ],
    });

    return { secondaryProjectId: secondaryProject.id };
  }

  it('aggregates activity across projects, counts shipped tickets from completed ship jobs, and preserves missing-cost cells', async () => {
    await seedProjectsActivityFixtures();

    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity', {
        headers: {
          'x-test-user-id': 'test-user-id',
        },
      })
    );

    const body = (await response.json()) as {
      filters: { year: string; agent: string };
      summary: { totalJobs: number; ticketsShipped: number; periodLabel: string };
      availableAgents: Array<{ value: string; label: string }>;
      periodOptions: Array<{ value: string; label: string }>;
      heatmap: {
        hasActivity: boolean;
        totalWeeks: number;
        weeks: Array<{
          days: Array<{
            date: string;
            jobCount: number;
            shippedTickets: number;
            totalCostUsd: number | null;
          } | null>;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ year: 'rolling', agent: 'all' });
    expect(body.summary).toMatchObject({
      totalJobs: 4,
      ticketsShipped: 2,
      periodLabel: 'Last 12 months',
    });
    expect(body.availableAgents).toEqual([
      { value: 'all', label: 'All agents' },
      { value: 'CLAUDE', label: 'Claude' },
      { value: 'CODEX', label: 'Codex' },
    ]);
    expect(body.periodOptions).toEqual([
      { value: 'rolling', label: 'Last 12 months' },
      { value: '2024', label: '2024' },
      { value: '2025', label: '2025' },
      { value: '2026', label: '2026' },
    ]);
    expect(body.heatmap.hasActivity).toBe(true);
    expect(body.heatmap.totalWeeks).toBeGreaterThan(50);

    const allDays = body.heatmap.weeks.flatMap((week) => week.days.filter(Boolean));

    expect(allDays).toContainEqual(
      expect.objectContaining({
        date: '2026-04-12',
        jobCount: 2,
        shippedTickets: 1,
        totalCostUsd: null,
      })
    );
    expect(allDays).toContainEqual(
      expect.objectContaining({
        date: '2026-03-15',
        jobCount: 1,
        shippedTickets: 1,
        totalCostUsd: 4.5,
      })
    );
    expect(allDays).toContainEqual(
      expect.objectContaining({
        date: '2026-04-11',
        jobCount: 1,
        shippedTickets: 0,
        totalCostUsd: 1.25,
      })
    );
  });

  it('filters by effective agent and keeps the full selected period shape', async () => {
    await seedProjectsActivityFixtures();

    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity?agent=CODEX&year=2026', {
        headers: {
          'x-test-user-id': 'test-user-id',
        },
      })
    );

    const body = (await response.json()) as {
      filters: { year: string; agent: string };
      summary: { totalJobs: number; ticketsShipped: number; periodLabel: string };
      heatmap: {
        totalWeeks: number;
        firstDate: string;
        lastDate: string;
        weeks: Array<{
          days: Array<{
            date: string;
            jobCount: number;
            shippedTickets: number;
          } | null>;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ year: '2026', agent: 'CODEX' });
    expect(body.summary).toMatchObject({
      totalJobs: 3,
      ticketsShipped: 1,
      periodLabel: '2026',
    });
    expect(body.heatmap.firstDate).toBe('2026-01-01');
    expect(body.heatmap.lastDate).toBe('2026-12-31');
    expect(body.heatmap.totalWeeks).toBe(53);

    const allDays = body.heatmap.weeks.flatMap((week) => week.days.filter(Boolean));
    expect(allDays).toContainEqual(
      expect.objectContaining({ date: '2026-04-12', jobCount: 2, shippedTickets: 1 })
    );
    expect(allDays).toContainEqual(
      expect.objectContaining({ date: '2026-04-11', jobCount: 1, shippedTickets: 0 })
    );
    expect(allDays).toContainEqual(
      expect.objectContaining({ date: '2026-03-15', jobCount: 0, shippedTickets: 0 })
    );
  });

  it('collapses the year selector when the user was created this year and returns an empty-state period', async () => {
    await prisma.user.update({
      where: { id: 'test-user-id' },
      data: {
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity?year=2025', {
        headers: {
          'x-test-user-id': 'test-user-id',
        },
      })
    );

    const body = (await response.json()) as {
      filters: { year: string; agent: string };
      periodOptions: Array<{ value: string; label: string }>;
      availableAgents: Array<{ value: string; label: string }>;
      summary: { totalJobs: number; ticketsShipped: number };
      heatmap: { hasActivity: boolean; totalWeeks: number };
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ year: 'rolling', agent: 'all' });
    expect(body.periodOptions).toEqual([{ value: 'rolling', label: 'Last 12 months' }]);
    expect(body.availableAgents).toEqual([{ value: 'all', label: 'All agents' }]);
    expect(body.summary).toMatchObject({ totalJobs: 0, ticketsShipped: 0 });
    expect(body.heatmap).toMatchObject({ hasActivity: false });
    expect(body.heatmap.totalWeeks).toBeGreaterThan(50);
  });
});
