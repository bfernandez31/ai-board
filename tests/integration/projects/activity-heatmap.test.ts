import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Projects Activity Heatmap API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00.000Z'));
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates activity across all accessible projects and filters by agent and year', async () => {
    const secondProject = await prisma.project.create({
      data: {
        name: '[e2e] Activity Project 2',
        description: 'secondary activity project',
        githubOwner: 'test',
        githubRepo: `activity-${Date.now()}`,
        key: `A${Date.now().toString().slice(-5)}`,
        userId: 'test-user-id',
        defaultAgent: Agent.CODEX,
        updatedAt: new Date('2026-04-10T12:00:00.000Z'),
      },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId: ctx.projectId,
          title: '[e2e] shipped claude',
          description: 'recent shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-1',
          updatedAt: new Date('2026-04-13T10:00:00.000Z'),
        },
        {
          projectId: secondProject.id,
          title: '[e2e] shipped codex',
          description: 'recent shipped codex ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1,
          ticketKey: 'ACT-1',
          updatedAt: new Date('2026-04-10T08:00:00.000Z'),
        },
        {
          projectId: ctx.projectId,
          title: '[e2e] shipped last year',
          description: 'older shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'E2E-2',
          updatedAt: new Date('2025-01-10T09:00:00.000Z'),
        },
      ],
    });

    const idByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-04-13T09:00:00.000Z'),
          completedAt: new Date('2026-04-13T09:30:00.000Z'),
          updatedAt: new Date('2026-04-13T09:30:00.000Z'),
          costUsd: 1.25,
        },
        {
          ticketId: idByKey.get('ACT-1')!,
          projectId: secondProject.id,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: new Date('2026-04-10T07:00:00.000Z'),
          completedAt: new Date('2026-04-10T07:10:00.000Z'),
          updatedAt: new Date('2026-04-10T07:10:00.000Z'),
          costUsd: 2.5,
        },
        {
          ticketId: idByKey.get('E2E-2')!,
          projectId: ctx.projectId,
          command: 'plan',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2025-01-10T08:00:00.000Z'),
          completedAt: new Date('2025-01-10T08:15:00.000Z'),
          updatedAt: new Date('2025-01-10T08:15:00.000Z'),
          costUsd: 0.75,
        },
      ],
    });

    const rollingResponse = await ctx.api.get<{
      availableYears: number[];
      summary: { jobCount: number; shippedCount: number; totalCost: number; label: string };
      availableAgents: Array<{ value: string; jobCount: number }>;
      days: Array<{ date: string; jobCount: number; shippedCount: number; totalCost: number }>;
    }>('/api/projects/activity?year=rolling&agent=all');

    expect(rollingResponse.status).toBe(200);
    expect(rollingResponse.data.availableYears).toEqual([2026, 2025]);
    expect(rollingResponse.data.summary).toMatchObject({
      jobCount: 2,
      shippedCount: 2,
      totalCost: 3.75,
      label: 'in the last year',
    });
    expect(rollingResponse.data.availableAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'all', jobCount: 3 }),
        expect.objectContaining({ value: 'CLAUDE', jobCount: 2 }),
        expect.objectContaining({ value: 'CODEX', jobCount: 1 }),
      ])
    );
    expect(rollingResponse.data.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-04-13',
          jobCount: 1,
          shippedCount: 1,
          totalCost: 1.25,
        }),
        expect.objectContaining({
          date: '2026-04-10',
          jobCount: 1,
          shippedCount: 1,
          totalCost: 2.5,
        }),
      ])
    );

    const codexResponse = await ctx.api.get<{
      filters: { agent: string; year: string };
      summary: { jobCount: number; shippedCount: number; totalCost: number };
    }>('/api/projects/activity?year=rolling&agent=CODEX');

    expect(codexResponse.status).toBe(200);
    expect(codexResponse.data.filters).toEqual({ year: 'rolling', agent: 'CODEX' });
    expect(codexResponse.data.summary).toMatchObject({
      jobCount: 1,
      shippedCount: 1,
      totalCost: 2.5,
    });

    const yearResponse = await ctx.api.get<{
      filters: { year: string };
      summary: { jobCount: number; shippedCount: number; totalCost: number; label: string };
    }>('/api/projects/activity?year=2025&agent=all');

    expect(yearResponse.status).toBe(200);
    expect(yearResponse.data.filters.year).toBe('2025');
    expect(yearResponse.data.summary).toMatchObject({
      jobCount: 1,
      shippedCount: 1,
      totalCost: 0.75,
      label: 'in 2025',
    });
  });
});
