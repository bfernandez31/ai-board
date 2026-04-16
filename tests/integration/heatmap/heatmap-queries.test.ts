import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
  getCurrentUser: vi.fn(),
  getCurrentUserOrNull: vi.fn(),
  getCurrentUserOrToken: vi.fn(),
  deleteUserAccount: vi.fn(),
  getTestUserOverrideResolution: vi.fn(),
  logBlockedTestUserOverrideAttempt: vi.fn(),
  StripeCleanupError: class extends Error {},
}));

import { getHeatmapData } from '@/lib/heatmap/queries';

const prisma = getPrismaClient();

const TEST_USER_ID = 'test-user-id';

async function setUserCreatedAt(userId: string, createdAt: Date) {
  await prisma.user.update({
    where: { id: userId },
    data: { createdAt, updatedAt: new Date() },
  });
}

async function createOrphanProject(ownerUserId: string, key: string) {
  const orphanOwner = await prisma.user.upsert({
    where: { email: 'heatmap-orphan@e2e.local' },
    update: {},
    create: {
      id: 'heatmap-orphan-user',
      email: 'heatmap-orphan@e2e.local',
      name: 'Heatmap Orphan',
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });

  return prisma.project.create({
    data: {
      name: `[e2e] heatmap-${key}`,
      key,
      description: 'heatmap orphan project',
      githubOwner: `orphan-owner-${key}`,
      githubRepo: `orphan-repo-${key}`,
      userId: orphanOwner.id,
      updatedAt: new Date(),
      defaultAgent: Agent.CLAUDE,
    },
  });
}

describe('getHeatmapData', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await setUserCreatedAt(TEST_USER_ID, new Date(2024, 0, 1));
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
  });

  it('scopes jobs to accessible projects only (owner OR member)', async () => {
    const orphanProject = await createOrphanProject(TEST_USER_ID, 'H01');
    const orphanTicket = await prisma.ticket.create({
      data: {
        projectId: orphanProject.id,
        title: '[e2e] orphan ticket',
        description: 'should not appear',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: 'HMO-1',
        updatedAt: new Date(),
      },
    });
    const now = new Date();
    await prisma.job.create({
      data: {
        ticketId: orphanTicket.id,
        projectId: orphanProject.id,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
        costUsd: 99,
      },
    });

    const data = await getHeatmapData(TEST_USER_ID, {});

    expect(data.totals.jobCount).toBe(0);
    expect(data.totals.shippedTicketCount).toBe(0);

    await prisma.job.deleteMany({ where: { projectId: orphanProject.id } });
    await prisma.ticket.deleteMany({ where: { projectId: orphanProject.id } });
    await prisma.project.delete({ where: { id: orphanProject.id } });
  });

  it('bucket counts jobs, respects ticket→project default agent fallback, and ignores null completedAt', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] heatmap ticket',
        description: 'heatmap data',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 100,
        ticketKey: `${ctx.projectId}-HMAP-100`,
        updatedAt: new Date(),
      },
    });
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
          costUsd: 0.5,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.FAILED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
          costUsd: null,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'specify',
          status: JobStatus.PENDING,
          startedAt: day,
          completedAt: null,
          updatedAt: day,
        },
      ],
    });

    const data = await getHeatmapData(TEST_USER_ID, {});
    expect(data.totals.jobCount).toBe(2);
    expect(data.availableAgents).toEqual([]);

    const dateKey = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    ].join('-');
    const cell = data.days.find((d) => d.date === dateKey);
    expect(cell?.jobCount).toBe(2);
    expect(cell?.totalCost).toBe(0.5);
  });

  it('counts shipped tickets only when ship job COMPLETED, DISTINCT on ticketId', async () => {
    const ticketA = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] ship ticket A',
        description: 'ship A',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 200,
        ticketKey: `${ctx.projectId}-HMAP-200`,
        updatedAt: new Date(),
      },
    });
    const ticketB = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] ship ticket B (failed)',
        description: 'ship B failed',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 201,
        ticketKey: `${ctx.projectId}-HMAP-201`,
        updatedAt: new Date(),
      },
    });
    const day = new Date();
    day.setHours(14, 0, 0, 0);

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticketA.id,
          projectId: ctx.projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
        },
        {
          ticketId: ticketA.id,
          projectId: ctx.projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
        },
        {
          ticketId: ticketB.id,
          projectId: ctx.projectId,
          command: 'ship',
          status: JobStatus.FAILED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
        },
      ],
    });

    const data = await getHeatmapData(TEST_USER_ID, {});
    expect(data.totals.shippedTicketCount).toBe(1);
  });

  it('sums costs null-safely (mixed null + non-null) and returns null when every job has null cost', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] cost ticket',
        description: 'costs',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 300,
        ticketKey: `${ctx.projectId}-HMAP-300`,
        updatedAt: new Date(),
      },
    });
    const mixedDay = new Date();
    mixedDay.setHours(10, 0, 0, 0);
    const nullDay = new Date(mixedDay.getTime() - 24 * 60 * 60 * 1000);

    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: mixedDay,
          completedAt: mixedDay,
          updatedAt: mixedDay,
          costUsd: 0.1,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: mixedDay,
          completedAt: mixedDay,
          updatedAt: mixedDay,
          costUsd: null,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: nullDay,
          completedAt: nullDay,
          updatedAt: nullDay,
          costUsd: null,
        },
      ],
    });

    const data = await getHeatmapData(TEST_USER_ID, {});

    const mixedKey = [
      mixedDay.getFullYear(),
      String(mixedDay.getMonth() + 1).padStart(2, '0'),
      String(mixedDay.getDate()).padStart(2, '0'),
    ].join('-');
    const nullKey = [
      nullDay.getFullYear(),
      String(nullDay.getMonth() + 1).padStart(2, '0'),
      String(nullDay.getDate()).padStart(2, '0'),
    ].join('-');

    const mixedCell = data.days.find((d) => d.date === mixedKey);
    const nullCell = data.days.find((d) => d.date === nullKey);

    expect(mixedCell?.totalCost).toBeCloseTo(0.1, 5);
    expect(nullCell?.totalCost).toBeNull();
  });

  it('keeps grid boundaries stable when agent filter is applied and computes availableAgents from unfiltered data', async () => {
    const claudeTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] claude ticket',
        description: 'claude',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 400,
        ticketKey: `${ctx.projectId}-HMAP-400`,
        updatedAt: new Date(),
        agent: Agent.CLAUDE,
      },
    });
    const codexTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] codex ticket',
        description: 'codex',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 401,
        ticketKey: `${ctx.projectId}-HMAP-401`,
        updatedAt: new Date(),
        agent: Agent.CODEX,
      },
    });
    const day = new Date();
    day.setHours(16, 0, 0, 0);
    await prisma.job.createMany({
      data: [
        {
          ticketId: claudeTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
        },
        {
          ticketId: codexTicket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: day,
          completedAt: day,
          updatedAt: day,
        },
      ],
    });

    const unfiltered = await getHeatmapData(TEST_USER_ID, {});
    const claudeOnly = await getHeatmapData(TEST_USER_ID, { agent: 'CLAUDE' });

    expect(unfiltered.availableAgents.map((a) => a.value).sort()).toEqual(['CLAUDE', 'CODEX']);
    expect(claudeOnly.availableAgents.map((a) => a.value).sort()).toEqual(['CLAUDE', 'CODEX']);
    expect(claudeOnly.days.length).toBe(unfiltered.days.length);
    expect(claudeOnly.days[0]!.date).toBe(unfiltered.days[0]!.date);
    expect(claudeOnly.totals.jobCount).toBe(1);
    expect(unfiltered.totals.jobCount).toBe(2);
  });

  it('returns 366 in-period days for a leap-year request', async () => {
    await setUserCreatedAt(TEST_USER_ID, new Date(2020, 0, 1));

    const data = await getHeatmapData(TEST_USER_ID, { period: '2024' });
    const inPeriod = data.days.filter((d) => d.inPeriod);
    expect(inPeriod).toHaveLength(366);
  });

  it('silently falls back to last-12-months for year before account creation', async () => {
    await setUserCreatedAt(TEST_USER_ID, new Date(2024, 5, 1));

    const data = await getHeatmapData(TEST_USER_ID, { period: '2019' });
    expect(data.filters.period).toBe('last-12-months');
  });

  it('returns empty totals and [] availableAgents for a user with no jobs', async () => {
    const data = await getHeatmapData(TEST_USER_ID, {});
    expect(data.totals.jobCount).toBe(0);
    expect(data.availableAgents).toEqual([]);
    for (const day of data.days) {
      expect(day.intensityLevel).toBe(0);
    }
  });
});
