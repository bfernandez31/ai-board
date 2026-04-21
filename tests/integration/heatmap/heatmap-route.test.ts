/**
 * Integration tests: GET /api/projects/activity-heatmap (AIB-704)
 *
 * Covers T012 (auth, empty-state shape, owner-OR-member scope, future clamp),
 * T031 (cost null-safety, ship detection via command+status), and T034
 * (effective-agent filter, availableAgents from unfiltered dataset).
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn<(request?: unknown) => Promise<string>>(),
}));

vi.mock('@/lib/db/users', () => ({
  requireAuth: (request?: unknown) => requireAuthMock(request),
}));

const { GET } = await import('@/app/api/projects/activity-heatmap/route');

interface HeatmapResponse {
  filters: { period: { kind: string; months?: number; year?: number }; agent: string };
  period: { startDate: string; endDate: string; label: string };
  days: Array<{
    date: string;
    jobCount: number;
    sumCostUsd: number;
    hasAnyCost: boolean;
    shippedTickets: Array<{ ticketKey: string; title: string }>;
    intensity: number;
  }>;
  totals: { jobs: number; ticketsShipped: number };
  availableAgents: Array<{ value: string; label: string; jobCount: number }>;
  accountCreatedYear: number;
}

async function callRoute(
  url = 'http://localhost/api/projects/activity-heatmap'
): Promise<{ status: number; body: HeatmapResponse | { error: string } }> {
  const response = await GET(new NextRequest(url));
  const body = (await response.json()) as HeatmapResponse | { error: string };
  return { status: response.status, body };
}

describe('GET /api/projects/activity-heatmap', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    requireAuthMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    requireAuthMock.mockRejectedValue(new Error('Unauthorized'));
    const { status, body } = await callRoute();
    expect(status).toBe(401);
    expect((body as { error: string }).error).toBe('Unauthorized');
  });

  it('returns 200 with empty-state shape when user has no activity', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    expect(testUser).toBeTruthy();
    requireAuthMock.mockResolvedValue(testUser!.id);

    const { status, body } = await callRoute();
    expect(status).toBe(200);
    const res = body as HeatmapResponse;
    expect(res.totals.jobs).toBe(0);
    expect(res.totals.ticketsShipped).toBe(0);
    expect(res.availableAgents).toEqual([]);
    // A rolling-12-month window should enumerate at least 365 days
    expect(res.days.length).toBeGreaterThanOrEqual(365);
  });

  it('scopes reads to owner-OR-member projects; excludes third-party projects', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    expect(testUser).toBeTruthy();
    requireAuthMock.mockResolvedValue(testUser!.id);

    // Seed a job on the worker project (owned by test user)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] ownable ticket',
        description: 'test',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1001,
        ticketKey: `OWN-1001`,
        updatedAt: yesterday,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: yesterday,
        completedAt: yesterday,
        updatedAt: yesterday,
      },
    });

    // Seed a completely separate user + project with its own ticket + job
    const thirdPartyUser = await prisma.user.upsert({
      where: { email: 'third-party@e2e.local' },
      update: {},
      create: {
        id: `third-party-${Date.now()}`,
        email: 'third-party@e2e.local',
        name: 'Third Party',
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });
    const thirdProject = await prisma.project.create({
      data: {
        key: `X${String(Date.now()).slice(-2)}`,
        name: '[e2e] third-party project',
        description: 'not visible',
        githubOwner: 'third',
        githubRepo: `third-${Date.now()}`,
        userId: thirdPartyUser.id,
        updatedAt: new Date(),
      },
    });
    const thirdTicket = await prisma.ticket.create({
      data: {
        projectId: thirdProject.id,
        title: '[e2e] third-party ticket',
        description: 'should not appear',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 2001,
        ticketKey: 'TP-2001',
        updatedAt: yesterday,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: thirdTicket.id,
        projectId: thirdProject.id,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: yesterday,
        completedAt: yesterday,
        updatedAt: yesterday,
      },
    });

    const { status, body } = await callRoute();
    expect(status).toBe(200);
    const res = body as HeatmapResponse;
    // Exactly one job (our own) — third-party job is excluded
    expect(res.totals.jobs).toBe(1);

    // Cleanup extra fixtures to keep the worker project clean
    await prisma.job.deleteMany({ where: { projectId: thirdProject.id } });
    await prisma.ticket.deleteMany({ where: { projectId: thirdProject.id } });
    await prisma.project.delete({ where: { id: thirdProject.id } });
    await prisma.user.delete({ where: { id: thirdPartyUser.id } });
  });

  it('counts ship jobs (command=ship && status=COMPLETED) and attaches shippedTickets; stage-only does not ship (T031, FR-003)', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    requireAuthMock.mockResolvedValue(testUser!.id);

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    // Ticket A: has a COMPLETED ship job → should count
    const ticketA = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] shipped via ship job',
        description: '',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 101,
        ticketKey: 'SHIP-101',
        updatedAt: daysAgo(1),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticketA.id,
        projectId: ctx.projectId,
        command: 'ship',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
    });

    // Ticket B: stage=SHIP but no ship job → should NOT count (FR-003)
    const ticketB = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] stage=SHIP but no ship job',
        description: '',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 102,
        ticketKey: 'SHIP-102',
        updatedAt: daysAgo(1),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticketB.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
    });

    const { body } = await callRoute();
    const res = body as HeatmapResponse;
    expect(res.totals.ticketsShipped).toBe(1);
    const allShipped = res.days.flatMap((d) => d.shippedTickets.map((t) => t.ticketKey));
    expect(allShipped).toContain('SHIP-101');
    expect(allShipped).not.toContain('SHIP-102');
  });

  it('handles per-day cost null-safety: day with all costUsd=null → hasAnyCost=false, sumCostUsd=0 (T031, invariant #4)', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    requireAuthMock.mockResolvedValue(testUser!.id);

    const now = new Date();
    const two = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] no-cost day',
        description: '',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 201,
        ticketKey: 'COST-201',
        updatedAt: two,
      },
    });
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: two,
          completedAt: two,
          updatedAt: two,
          costUsd: null,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: two,
          completedAt: two,
          updatedAt: two,
          costUsd: null,
        },
      ],
    });

    const { body } = await callRoute();
    const res = body as HeatmapResponse;
    const day = res.days.find((d) => d.jobCount >= 2 && d.shippedTickets.length === 0);
    expect(day).toBeTruthy();
    expect(day!.hasAnyCost).toBe(false);
    expect(day!.sumCostUsd).toBe(0);
  });

  it('sums cost exactly when some jobs have cost (T031, invariant #4)', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    requireAuthMock.mockResolvedValue(testUser!.id);

    const now = new Date();
    const two = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] mixed-cost day',
        description: '',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 202,
        ticketKey: 'COST-202',
        updatedAt: two,
      },
    });
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: two,
          completedAt: two,
          updatedAt: two,
          costUsd: 1.23,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: two,
          completedAt: two,
          updatedAt: two,
          costUsd: 0.77,
        },
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'plan',
          status: JobStatus.COMPLETED,
          startedAt: two,
          completedAt: two,
          updatedAt: two,
          costUsd: null,
        },
      ],
    });

    const { body } = await callRoute();
    const res = body as HeatmapResponse;
    const day = res.days.find((d) => d.jobCount >= 3);
    expect(day).toBeTruthy();
    expect(day!.hasAnyCost).toBe(true);
    expect(day!.sumCostUsd).toBeCloseTo(2.0, 2);
  });

  it('includes ticket with agent=null when project.defaultAgent matches the selected agent filter (T034, effective agent)', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    requireAuthMock.mockResolvedValue(testUser!.id);

    // Set the worker project's default agent
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CODEX },
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ticketNullAgent = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] null-agent ticket inherits CODEX',
        description: '',
        stage: Stage.BUILD,
        workflowType: WorkflowType.FULL,
        ticketNumber: 301,
        ticketKey: 'EFF-301',
        agent: null,
        updatedAt: yesterday,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticketNullAgent.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: yesterday,
        completedAt: yesterday,
        updatedAt: yesterday,
      },
    });

    const { body } = await callRoute('http://localhost/api/projects/activity-heatmap?agent=CODEX');
    const res = body as HeatmapResponse;
    expect(res.totals.jobs).toBe(1);
    expect(res.filters.agent).toBe('CODEX');
  });

  it('computes availableAgents from UNFILTERED dataset (invariant #8)', async () => {
    const testUser = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    requireAuthMock.mockResolvedValue(testUser!.id);

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [ticketClaude, ticketCodex] = await Promise.all([
      prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: '[e2e] claude ticket',
          description: '',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 401,
          ticketKey: 'AV-401',
          agent: Agent.CLAUDE,
          updatedAt: yesterday,
        },
      }),
      prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: '[e2e] codex ticket',
          description: '',
          stage: Stage.BUILD,
          workflowType: WorkflowType.FULL,
          ticketNumber: 402,
          ticketKey: 'AV-402',
          agent: Agent.CODEX,
          updatedAt: yesterday,
        },
      }),
    ]);
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticketClaude.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: yesterday,
          completedAt: yesterday,
          updatedAt: yesterday,
        },
        {
          ticketId: ticketCodex.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: yesterday,
          completedAt: yesterday,
          updatedAt: yesterday,
        },
      ],
    });

    // Apply agent=CODEX filter, but availableAgents should still reflect BOTH agents
    const { body } = await callRoute('http://localhost/api/projects/activity-heatmap?agent=CODEX');
    const res = body as HeatmapResponse;
    const agentValues = res.availableAgents.map((a) => a.value).sort();
    expect(agentValues).toEqual(expect.arrayContaining(['CLAUDE', 'CODEX']));
    expect(agentValues.length).toBeGreaterThanOrEqual(2);
  });
});
