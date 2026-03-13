import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { Agent, Stage, WorkflowType } from '@prisma/client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createTestTicket } from '@/tests/helpers/db-setup';

async function seedContractFixtures(projectId: number) {
  const prisma = getPrismaClient();

  await prisma.project.update({
    where: { id: projectId },
    data: {
      defaultAgent: Agent.CLAUDE,
      updatedAt: new Date('2026-03-13T12:00:00.000Z'),
    },
  });

  const shipped = await createTestTicket(projectId, {
    title: '[e2e] contract shipped',
    description: 'Contract shipped ticket',
  });
  await prisma.ticket.update({
    where: { id: shipped.id },
    data: {
      stage: Stage.SHIP,
      workflowType: WorkflowType.FULL,
      agent: Agent.CLAUDE,
      updatedAt: new Date('2026-03-12T12:00:00.000Z'),
    },
  });

  const closed = await createTestTicket(projectId, {
    title: '[e2e] contract closed',
    description: 'Contract closed ticket',
  });
  await prisma.ticket.update({
    where: { id: closed.id },
    data: {
      stage: Stage.CLOSED,
      workflowType: WorkflowType.QUICK,
      agent: Agent.CODEX,
      closedAt: new Date('2026-03-11T12:00:00.000Z'),
      updatedAt: new Date('2026-03-11T12:00:00.000Z'),
    },
  });

  await prisma.job.createMany({
    data: [
      {
        projectId,
        ticketId: shipped.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-12T11:00:00.000Z'),
        completedAt: new Date('2026-03-12T12:00:00.000Z'),
        updatedAt: new Date('2026-03-12T12:00:00.000Z'),
        costUsd: 4,
        durationMs: 1000,
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 5,
        cacheCreationTokens: 1,
        toolsUsed: ['Edit'],
      },
      {
        projectId,
        ticketId: closed.id,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-11T11:00:00.000Z'),
        completedAt: new Date('2026-03-11T12:00:00.000Z'),
        updatedAt: new Date('2026-03-11T12:00:00.000Z'),
        costUsd: 6,
        durationMs: 2000,
        inputTokens: 120,
        outputTokens: 60,
        cacheReadTokens: 10,
        cacheCreationTokens: 2,
        toolsUsed: ['Read'],
      },
    ],
  });
}

describe('Project analytics contract', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await seedContractFixtures(ctx.projectId);
  });

  it('returns normalized filter metadata and available agent options', async () => {
    const response = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped%2Bclosed&agentScope=all`
    );

    expect(response.status).toBe(200);
    expect(response.data.filters).toEqual({
      timeRange: '30d',
      statusScope: 'shipped+closed',
      agentScope: 'all',
      periodLabel: 'Last 30 days',
    });
    expect(response.data.availableAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'CLAUDE', label: 'Claude', jobCount: 1 }),
        expect.objectContaining({ value: 'CODEX', label: 'Codex', jobCount: 1 }),
      ])
    );
  });

  it('keeps overview summaries consistent across shipped, closed, and combined scopes', async () => {
    const shipped = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped`
    );
    expect(shipped.status).toBe(200);
    expect(shipped.data.overview).toMatchObject({
      ticketsShipped: 1,
      ticketsClosed: 0,
      ticketPeriodLabel: 'Last 30 days',
    });

    const closed = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=closed`
    );
    expect(closed.status).toBe(200);
    expect(closed.data.overview).toMatchObject({
      ticketsShipped: 0,
      ticketsClosed: 1,
      ticketPeriodLabel: 'Last 30 days',
    });

    const combined = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped%2Bclosed`
    );
    expect(combined.status).toBe(200);
    expect(combined.data.overview).toMatchObject({
      ticketsShipped: 1,
      ticketsClosed: 1,
      ticketPeriodLabel: 'Last 30 days',
    });
  });

  it('rejects invalid analytics filters', async () => {
    const response = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped&agentScope=INVALID`
    );

    expect(response.status).toBe(400);
    expect(response.data).toMatchObject({
      error: 'Invalid analytics filter',
      code: 'INVALID_QUERY',
    });
  });
});
