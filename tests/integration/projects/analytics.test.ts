import { Agent, Stage, WorkflowType } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createTestTicket } from '@/tests/helpers/db-setup';

async function seedAnalyticsFixtures(projectId: number) {
  const prisma = getPrismaClient();
  const now = new Date('2026-03-13T12:00:00.000Z');

  await prisma.project.update({
    where: { id: projectId },
    data: {
      defaultAgent: Agent.CLAUDE,
      updatedAt: now,
    },
  });

  const shippedClaude = await createTestTicket(projectId, {
    title: '[e2e] shipped claude',
    description: 'Recent shipped ticket',
  });
  await prisma.ticket.update({
    where: { id: shippedClaude.id },
    data: {
      stage: Stage.SHIP,
      agent: Agent.CLAUDE,
      workflowType: WorkflowType.FULL,
      updatedAt: new Date('2026-03-10T12:00:00.000Z'),
    },
  });

  const closedCodex = await createTestTicket(projectId, {
    title: '[e2e] closed codex',
    description: 'Recent closed ticket',
  });
  await prisma.ticket.update({
    where: { id: closedCodex.id },
    data: {
      stage: Stage.CLOSED,
      agent: Agent.CODEX,
      workflowType: WorkflowType.QUICK,
      closedAt: new Date('2026-03-09T12:00:00.000Z'),
      updatedAt: new Date('2026-03-09T12:00:00.000Z'),
    },
  });

  const shippedCodexOld = await createTestTicket(projectId, {
    title: '[e2e] old shipped codex',
    description: 'Historical shipped ticket',
  });
  await prisma.ticket.update({
    where: { id: shippedCodexOld.id },
    data: {
      stage: Stage.SHIP,
      agent: Agent.CODEX,
      workflowType: WorkflowType.CLEAN,
      updatedAt: new Date('2025-12-15T12:00:00.000Z'),
    },
  });

  await prisma.job.createMany({
    data: [
      {
        projectId,
        ticketId: shippedClaude.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-10T11:00:00.000Z'),
        completedAt: new Date('2026-03-10T12:00:00.000Z'),
        updatedAt: new Date('2026-03-10T12:00:00.000Z'),
        costUsd: 10,
        durationMs: 60000,
        inputTokens: 1000,
        outputTokens: 400,
        cacheReadTokens: 100,
        cacheCreationTokens: 50,
        toolsUsed: ['Edit'],
      },
      {
        projectId,
        ticketId: closedCodex.id,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2026-03-09T11:00:00.000Z'),
        completedAt: new Date('2026-03-09T12:00:00.000Z'),
        updatedAt: new Date('2026-03-09T12:00:00.000Z'),
        costUsd: 5,
        durationMs: 30000,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 20,
        cacheCreationTokens: 10,
        toolsUsed: ['Read'],
      },
      {
        projectId,
        ticketId: shippedCodexOld.id,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2025-12-15T11:00:00.000Z'),
        completedAt: new Date('2025-12-15T12:00:00.000Z'),
        updatedAt: new Date('2025-12-15T12:00:00.000Z'),
        costUsd: 7,
        durationMs: 45000,
        inputTokens: 750,
        outputTokens: 200,
        cacheReadTokens: 40,
        cacheCreationTokens: 5,
        toolsUsed: ['Edit'],
      },
    ],
  });
}

describe('Project analytics API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await seedAnalyticsFixtures(ctx.projectId);
  });

  it('defaults to shipped-only analytics and zeroes empty filtered views', async () => {
    const defaultResponse = await ctx.api.get(`/api/projects/${ctx.projectId}/analytics`);

    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.data.filters).toMatchObject({
      timeRange: '30d',
      statusScope: 'shipped',
      agentScope: 'all',
    });
    expect(defaultResponse.data.overview.ticketsShipped).toBe(1);
    expect(defaultResponse.data.overview.ticketsClosed).toBe(0);
    expect(defaultResponse.data.jobCount).toBe(1);

    const emptyResponse = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=7d&statusScope=shipped&agentScope=CODEX`
    );

    expect(emptyResponse.status).toBe(200);
    expect(emptyResponse.data.hasData).toBe(false);
    expect(emptyResponse.data.jobCount).toBe(0);
    expect(emptyResponse.data.availableAgents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'CLAUDE' }),
        expect.objectContaining({ value: 'CODEX' }),
      ])
    );
  });

  it('filters analytics by status scope permutations', async () => {
    const closedOnly = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=closed`
    );
    expect(closedOnly.status).toBe(200);
    expect(closedOnly.data.overview.ticketsShipped).toBe(0);
    expect(closedOnly.data.overview.ticketsClosed).toBe(1);
    expect(closedOnly.data.jobCount).toBe(1);

    const combined = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped%2Bclosed`
    );
    expect(combined.status).toBe(200);
    expect(combined.data.overview.ticketsShipped).toBe(1);
    expect(combined.data.overview.ticketsClosed).toBe(1);
    expect(combined.data.jobCount).toBe(2);
  });

  it('filters analytics by agent and keeps available agents stable across ranges', async () => {
    const claudeOnly = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=30d&statusScope=shipped%2Bclosed&agentScope=CLAUDE`
    );

    expect(claudeOnly.status).toBe(200);
    expect(claudeOnly.data.filters.agentScope).toBe('CLAUDE');
    expect(claudeOnly.data.jobCount).toBe(1);
    expect(claudeOnly.data.overview.ticketsShipped).toBe(1);
    expect(claudeOnly.data.overview.ticketsClosed).toBe(0);

    const historicalCodex = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=7d&statusScope=shipped%2Bclosed&agentScope=CODEX`
    );

    expect(historicalCodex.status).toBe(200);
    expect(historicalCodex.data.availableAgents).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'CODEX', jobCount: 2 })])
    );
  });

  it('returns period-aware shipped and closed ticket summaries', async () => {
    const sevenDays = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=7d&statusScope=shipped%2Bclosed`
    );
    expect(sevenDays.status).toBe(200);
    expect(sevenDays.data.overview.ticketPeriodLabel).toBe('Last 7 days');
    expect(sevenDays.data.overview.ticketsShipped).toBe(1);
    expect(sevenDays.data.overview.ticketsClosed).toBe(1);

    const allTime = await ctx.api.get(
      `/api/projects/${ctx.projectId}/analytics?range=all&statusScope=shipped%2Bclosed`
    );
    expect(allTime.status).toBe(200);
    expect(allTime.data.overview.ticketPeriodLabel).toBe('All time');
    expect(allTime.data.overview.ticketsShipped).toBe(2);
    expect(allTime.data.overview.ticketsClosed).toBe(1);
  });
});
