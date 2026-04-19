import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/activity-heatmap/route';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

describe('Projects Activity Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.user.update({
      where: { id: 'test-user-id' },
      data: {
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
      },
    });
  });

  async function seedActivityFixtures(projectId: number) {
    const secondProject = await prisma.project.create({
      data: {
        name: '[e2e] secondary activity project',
        description: 'secondary project',
        githubOwner: 'acme',
        githubRepo: `secondary-${Date.now()}`,
        key: 'HTM',
        userId: 'test-user-id',
        updatedAt: new Date('2026-04-10T10:00:00.000Z'),
        defaultAgent: Agent.GEMINI,
      },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] default-agent activity',
          description: 'uses project default agent',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-101',
          updatedAt: new Date('2026-04-10T09:30:00.000Z'),
        },
        {
          projectId,
          title: '[e2e] shipped by job',
          description: 'counts as shipped only via ship job',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'E2E-102',
          updatedAt: new Date('2026-04-10T11:00:00.000Z'),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] stage ship without ship job',
          description: 'must not count as shipped',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 3,
          ticketKey: 'E2E-103',
          updatedAt: new Date('2026-04-11T11:00:00.000Z'),
        },
        {
          projectId: secondProject.id,
          title: '[e2e] gemini inherited activity',
          description: 'uses second project default agent',
          stage: Stage.VERIFY,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1,
          ticketKey: 'HTM-1',
          updatedAt: new Date('2026-03-03T12:00:00.000Z'),
        },
      ],
    });

    const ticketIdByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticketIdByKey.get('E2E-101')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-10T09:00:00.000Z'),
          completedAt: new Date('2026-04-10T10:00:00.000Z'),
          updatedAt: new Date('2026-04-10T10:00:00.000Z'),
          costUsd: 1.25,
        },
        {
          ticketId: ticketIdByKey.get('E2E-102')!,
          projectId,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: new Date('2026-04-10T11:30:00.000Z'),
          completedAt: new Date('2026-04-10T12:00:00.000Z'),
          updatedAt: new Date('2026-04-10T12:00:00.000Z'),
          costUsd: null,
        },
        {
          ticketId: ticketIdByKey.get('E2E-102')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-10T12:15:00.000Z'),
          completedAt: new Date('2026-04-10T13:00:00.000Z'),
          updatedAt: new Date('2026-04-10T13:00:00.000Z'),
          costUsd: 2.5,
        },
        {
          ticketId: ticketIdByKey.get('E2E-102')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-10T13:15:00.000Z'),
          completedAt: new Date('2026-04-10T14:00:00.000Z'),
          updatedAt: new Date('2026-04-10T14:00:00.000Z'),
          costUsd: 2.75,
        },
        {
          ticketId: ticketIdByKey.get('E2E-103')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-11T09:00:00.000Z'),
          completedAt: new Date('2026-04-11T10:00:00.000Z'),
          updatedAt: new Date('2026-04-11T10:00:00.000Z'),
          costUsd: 0.75,
        },
        {
          ticketId: ticketIdByKey.get('HTM-1')!,
          projectId: secondProject.id,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-03-03T11:30:00.000Z'),
          completedAt: new Date('2026-03-03T12:00:00.000Z'),
          updatedAt: new Date('2026-03-03T12:00:00.000Z'),
          costUsd: 3.5,
        },
      ],
    });

    return secondProject.id;
  }

  it('aggregates activity across accessible projects and counts shipped tickets from completed ship jobs only', async () => {
    await seedActivityFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity-heatmap?period=2026')
    );
    const body = (await response.json()) as {
      filters: { period: string; agent: string };
      summary: { jobCount: number; shippedTicketCount: number; label: string };
      cells: Array<{
        date: string;
        jobCount: number;
        shippedTicketCount: number;
        totalCost: number | null;
        hasMissingCosts: boolean;
      }>;
      availableAgents: Array<{ value: string; label: string; jobCount: number }>;
      availablePeriods: Array<{ value: string; label: string }>;
      userCreatedYear: number;
      periodStart: string;
      periodEnd: string;
      hasAnyActivity: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({ period: '2026', agent: 'all' });
    expect(body.summary).toEqual({
      jobCount: 6,
      shippedTicketCount: 1,
      label: 'in 2026',
    });
    expect(body.periodStart).toBe('2026-01-01');
    expect(body.periodEnd).toBe('2026-12-31');
    expect(body.hasAnyActivity).toBe(true);
    expect(body.userCreatedYear).toBeLessThanOrEqual(2026);
    expect(body.availablePeriods).toEqual(
      expect.arrayContaining([
        { value: 'last-12-months', label: 'Last 12 months' },
        { value: '2026', label: '2026' },
      ])
    );
    expect(body.availableAgents).toEqual([
      expect.objectContaining({ value: 'all', jobCount: 6 }),
      expect.objectContaining({ value: 'CLAUDE', jobCount: 2 }),
      expect.objectContaining({ value: 'CODEX', jobCount: 3 }),
      expect.objectContaining({ value: 'GEMINI', jobCount: 1 }),
    ]);

    const april10 = body.cells.find((cell) => cell.date === '2026-04-10');
    const april11 = body.cells.find((cell) => cell.date === '2026-04-11');
    const march3 = body.cells.find((cell) => cell.date === '2026-03-03');

    expect(april10).toEqual({
      date: '2026-04-10',
      jobCount: 4,
      shippedTicketCount: 1,
      totalCost: null,
      hasMissingCosts: true,
    });
    expect(april11).toEqual({
      date: '2026-04-11',
      jobCount: 1,
      shippedTicketCount: 0,
      totalCost: 0.75,
      hasMissingCosts: false,
    });
    expect(march3).toEqual({
      date: '2026-03-03',
      jobCount: 1,
      shippedTicketCount: 0,
      totalCost: 3.5,
      hasMissingCosts: false,
    });
  });

  it('filters by effective agent and keeps full period metadata intact', async () => {
    await seedActivityFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity-heatmap?period=2026&agent=GEMINI')
    );
    const body = (await response.json()) as {
      summary: { jobCount: number; shippedTicketCount: number };
      cells: Array<{ date: string; jobCount: number; shippedTicketCount: number }>;
      periodStart: string;
      periodEnd: string;
    };

    expect(response.status).toBe(200);
    expect(body.summary).toEqual({
      jobCount: 1,
      shippedTicketCount: 0,
      label: 'in 2026',
    });
    expect(body.periodStart).toBe('2026-01-01');
    expect(body.periodEnd).toBe('2026-12-31');
    expect(body.cells).toEqual([
      {
        date: '2026-03-03',
        jobCount: 1,
        shippedTicketCount: 0,
        totalCost: 3.5,
        hasMissingCosts: false,
      },
    ]);
  });

  it('rejects invalid filter values', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/activity-heatmap?period=not-a-period')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid heatmap filters' });
  });
});
