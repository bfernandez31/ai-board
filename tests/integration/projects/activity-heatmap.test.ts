import { NextRequest } from 'next/server';
import { Agent, Stage, WorkflowType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/projects/activity/route';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getProjectKey } from '@/tests/helpers/db-cleanup';

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => 'test-user-id'),
}));

vi.mock('@/lib/db/users', () => ({
  requireAuth: requireAuthMock,
}));

describe('Projects Activity Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  let extraProjectIds: number[] = [];

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue('test-user-id');

    if (extraProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: extraProjectIds } },
      });
      extraProjectIds = [];
    }
  });

  function makeRequest(pathname: string, userId = 'test-user-id') {
    return new NextRequest(`http://localhost${pathname}`, {
      headers: {
        'x-test-user-id': userId,
      },
    });
  }

  async function seedWorkspaceActivity() {
    const memberOwner = await ctx.createUser(`member-owner-${Date.now()}@project${ctx.projectId}.e2e.test`);
    const outsiderOwner = await ctx.createUser(`outsider-owner-${Date.now()}@project${ctx.projectId}.e2e.test`);

    const memberProject = await prisma.project.create({
      data: {
        key: `M${Date.now().toString().slice(-5)}`,
        name: '[e2e] Shared member project',
        description: 'member project for heatmap route tests',
        githubOwner: 'test',
        githubRepo: `member-${Date.now()}`,
        userId: memberOwner.id,
        defaultAgent: Agent.CODEX,
        updatedAt: new Date(),
      },
    });

    const outsiderProject = await prisma.project.create({
      data: {
        key: `O${Date.now().toString().slice(-5)}`,
        name: '[e2e] Unrelated project',
        description: 'outsider project for heatmap route tests',
        githubOwner: 'test',
        githubRepo: `outsider-${Date.now()}`,
        userId: outsiderOwner.id,
        defaultAgent: Agent.MISTRAL,
        updatedAt: new Date(),
      },
    });

    extraProjectIds = [memberProject.id, outsiderProject.id];

    await prisma.projectMember.create({
      data: {
        projectId: memberProject.id,
        userId: 'test-user-id',
        role: 'member',
      },
    });

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) => {
      const value = new Date(now);
      value.setUTCDate(value.getUTCDate() - days);
      return value;
    };

    const currentProjectKey = getProjectKey(ctx.projectId);

    const ownedTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] Owned workspace activity',
        description: 'owned project activity',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: `${currentProjectKey}-1`,
        updatedAt: daysAgo(3),
      },
    });

    const memberTicket = await prisma.ticket.create({
      data: {
        projectId: memberProject.id,
        title: '[e2e] Shared workspace activity',
        description: 'member project activity',
        stage: Stage.SHIP,
        workflowType: WorkflowType.QUICK,
        ticketNumber: 1,
        ticketKey: `MEM-1`,
        updatedAt: daysAgo(2),
      },
    });

    const outsiderTicket = await prisma.ticket.create({
      data: {
        projectId: outsiderProject.id,
        title: '[e2e] Unrelated activity',
        description: 'outsider project activity',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: `OUT-1`,
        updatedAt: daysAgo(1),
      },
    });

    await prisma.job.createMany({
      data: [
        {
          ticketId: ownedTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.5,
        },
        {
          ticketId: ownedTicket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'FAILED',
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 2.25,
        },
        {
          ticketId: memberTicket.id,
          projectId: memberProject.id,
          command: 'implement',
          status: 'COMPLETED',
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null,
        },
        {
          ticketId: outsiderTicket.id,
          projectId: outsiderProject.id,
          command: 'implement',
          status: 'COMPLETED',
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 9.99,
        },
      ],
    });

    const lastYearTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] Prior year codex activity',
        description: 'calendar year activity',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 2,
        ticketKey: `${currentProjectKey}-2`,
        updatedAt: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 10)),
        agent: Agent.CODEX,
      },
    });

    await prisma.job.create({
      data: {
        ticketId: lastYearTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 10)),
        completedAt: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 10)),
        updatedAt: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 10)),
        costUsd: 3.4,
      },
    });

    return {
      priorYear: now.getUTCFullYear() - 1,
      ownedDayKey: daysAgo(3).toISOString().slice(0, 10),
    };
  }

  it('returns a full rolling workspace grid with owned and shared activity only', async () => {
    const { ownedDayKey } = await seedWorkspaceActivity();

    const response = await GET(makeRequest('/api/projects/activity'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.summary).toMatchObject({
      jobCount: 3,
      ticketsShipped: 2,
      costUsd: 3.75,
      hasAnyActivity: true,
      rangeLabel: 'the last year',
    });
    expect(body.days).toHaveLength(365);
    expect(body.availableAgents.map((option: { value: string }) => option.value)).toEqual(
      expect.arrayContaining(['all', 'CLAUDE', 'CODEX'])
    );
    expect(body.days.find((day: { date: string }) => day.date === ownedDayKey)).toMatchObject({
      jobCount: 1,
      ticketsShipped: 1,
    });
    expect(body.days.some((day: { jobCount: number; ticketsShipped: number }) => day.jobCount === 0 && day.ticketsShipped === 0)).toBe(true);
  });

  it('filters by calendar year and effective agent', async () => {
    const { priorYear } = await seedWorkspaceActivity();

    const response = await GET(
      makeRequest(`/api/projects/activity?view=year-${priorYear}&agent=CODEX`)
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.view.value).toBe(`year-${priorYear}`);
    expect(body.filters.agent).toBe('CODEX');
    expect(body.summary).toMatchObject({
      jobCount: 1,
      ticketsShipped: 1,
      costUsd: 3.4,
      hasAnyActivity: true,
      rangeLabel: String(priorYear),
    });
  });

  it('returns an empty full-year grid for a valid filter with no matching activity', async () => {
    const { priorYear } = await seedWorkspaceActivity();

    const response = await GET(
      makeRequest(`/api/projects/activity?view=year-${priorYear}&agent=MISTRAL`)
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.summary).toMatchObject({
      jobCount: 0,
      ticketsShipped: 0,
      costUsd: 0,
      hasAnyActivity: false,
    });
    expect(body.days.every((day: { intensityLevel: number }) => day.intensityLevel === 0)).toBe(true);
    expect(body.availableAgents.some((option: { value: string; jobCount: number }) => option.value === 'MISTRAL' && option.jobCount === 0)).toBe(true);
  });

  it('returns validation and auth errors for invalid requests', async () => {
    const invalidResponse = await GET(makeRequest('/api/projects/activity?view=year-9999'));
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    requireAuthMock.mockRejectedValueOnce(new Error('Unauthorized'));
    const unauthorizedRequest = new NextRequest('http://localhost/api/projects/activity');
    const unauthorizedResponse = await GET(unauthorizedRequest);
    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toMatchObject({
      code: 'AUTH_ERROR',
    });
  });
});
