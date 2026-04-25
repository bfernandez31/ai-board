import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/analytics/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Analytics Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function seedAnalyticsFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped default claude',
          description: 'analytics shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-1',
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] shipped codex',
          description: 'analytics shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 2,
          ticketKey: 'E2E-2',
          updatedAt: daysAgo(2),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] closed claude',
          description: 'analytics closed ticket',
          stage: Stage.CLOSED,
          workflowType: WorkflowType.CLEAN,
          ticketNumber: 3,
          ticketKey: 'E2E-3',
          updatedAt: daysAgo(5),
          closedAt: daysAgo(5),
        },
        {
          projectId,
          title: '[e2e] closed codex',
          description: 'analytics closed ticket',
          stage: Stage.CLOSED,
          workflowType: WorkflowType.FULL,
          ticketNumber: 4,
          ticketKey: 'E2E-4',
          updatedAt: daysAgo(4),
          closedAt: daysAgo(4),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] old shipped claude',
          description: 'old analytics ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 5,
          ticketKey: 'E2E-5',
          updatedAt: daysAgo(40),
        },
      ],
    });

    const idByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.5,
          durationMs: 1000,
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 20,
          cacheCreationTokens: 10,
          toolsUsed: ['Read', 'Edit'],
        },
        {
          ticketId: idByKey.get('E2E-2')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 2.5,
          durationMs: 2000,
          inputTokens: 200,
          outputTokens: 60,
          cacheReadTokens: 15,
          cacheCreationTokens: 5,
          toolsUsed: ['Bash'],
        },
        {
          ticketId: idByKey.get('E2E-3')!,
          projectId,
          command: 'plan',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 3.5,
          durationMs: 3000,
          inputTokens: 300,
          outputTokens: 70,
          cacheReadTokens: 30,
          cacheCreationTokens: 10,
          toolsUsed: ['Read'],
        },
        {
          ticketId: idByKey.get('E2E-4')!,
          projectId,
          command: 'implement',
          status: JobStatus.FAILED,
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
          updatedAt: daysAgo(4),
          costUsd: 4.0,
          durationMs: 4000,
          inputTokens: 400,
          outputTokens: 80,
          cacheReadTokens: 40,
          cacheCreationTokens: 10,
          toolsUsed: ['Edit'],
        },
        {
          ticketId: idByKey.get('E2E-5')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(40),
          completedAt: daysAgo(40),
          updatedAt: daysAgo(40),
          costUsd: 6.0,
          durationMs: 5000,
          inputTokens: 500,
          outputTokens: 90,
          cacheReadTokens: 50,
          cacheCreationTokens: 15,
          toolsUsed: ['Write'],
        },
      ],
    });
  }

  async function seedGeminiAnalyticsFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.GEMINI },
    });

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped supported gemini',
          description: 'analytics shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 11,
          ticketKey: 'E2E-11',
          updatedAt: daysAgo(2),
        },
        {
          projectId,
          title: '[e2e] shipped unsupported gemini',
          description: 'analytics shipped ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 12,
          ticketKey: 'E2E-12',
          updatedAt: daysAgo(1),
        },
        {
          projectId,
          title: '[e2e] closed codex history',
          description: 'analytics closed ticket',
          stage: Stage.CLOSED,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 13,
          ticketKey: 'E2E-13',
          updatedAt: daysAgo(3),
          closedAt: daysAgo(3),
          agent: Agent.CODEX,
        },
      ],
    });

    const idByKey = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-11')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 1.11,
          durationMs: 1200,
          inputTokens: 1000,
          outputTokens: 200,
          thinkingTokens: 100,
          cacheReadTokens: 80,
          cacheCreationTokens: 20,
          model: 'gemini-2.5-pro',
          toolsUsed: ['shell'],
        },
        {
          ticketId: idByKey.get('E2E-12')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: null,
          durationMs: 1800,
          inputTokens: 800,
          outputTokens: 250,
          thinkingTokens: 120,
          cacheReadTokens: 50,
          cacheCreationTokens: 10,
          model: 'gemini-experimental-x',
          toolsUsed: ['read_file'],
        },
        {
          ticketId: idByKey.get('E2E-13')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 2.25,
          durationMs: 900,
          inputTokens: 300,
          outputTokens: 90,
          thinkingTokens: null,
          cacheReadTokens: 10,
          cacheCreationTokens: 5,
          model: 'gpt-5.4',
          toolsUsed: ['Edit'],
        },
      ],
    });
  }

  it('filters shipped, closed, and all-completed datasets consistently', async () => {
    await seedAnalyticsFixtures(ctx.projectId);

    const shippedResponse = await GET(
      new NextRequest(`http://localhost/api/projects/${ctx.projectId}/analytics`),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const shipped = (await shippedResponse.json()) as {
      filters: { outcome: string; range: string; agent: string };
      jobCount: number;
      overview: { ticketsShipped: { count: number }; ticketsClosed: { count: number }; totalCost: number };
      workflowDistribution: Array<{ type: string; count: number }>;
      velocity: Array<{ week: string; ticketsShipped: number }>;
      hasData: boolean;
    };

    expect(shippedResponse.status).toBe(200);
    expect(shipped.filters).toEqual({
      range: '30d',
      outcome: 'shipped',
      agent: 'all',
    });
    expect(shipped.jobCount).toBe(2);
    expect(shipped.overview.ticketsShipped.count).toBe(2);
    expect(shipped.overview.ticketsClosed.count).toBe(0);
    expect(shipped.overview.totalCost).toBe(4);
    expect(shipped.workflowDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'FULL', count: 1 }),
        expect.objectContaining({ type: 'QUICK', count: 1 }),
      ])
    );
    expect(shipped.velocity.length).toBeGreaterThan(0);
    expect(shipped.hasData).toBe(true);

    const closedResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=closed`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const closed = (await closedResponse.json()) as {
      jobCount: number;
      overview: { ticketsShipped: { count: number }; ticketsClosed: { count: number }; totalCost: number; successRate: number };
      costByStage: Array<{ stage: string }>;
    };

    expect(closedResponse.status).toBe(200);
    expect(closed.jobCount).toBe(2);
    expect(closed.overview.ticketsShipped.count).toBe(0);
    expect(closed.overview.ticketsClosed.count).toBe(2);
    expect(closed.overview.totalCost).toBe(3.5);
    expect(closed.overview.successRate).toBe(50);
    expect(closed.costByStage).toEqual([expect.objectContaining({ stage: 'PLAN' })]);

    const allCompletedResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=all-completed`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const allCompleted = (await allCompletedResponse.json()) as {
      jobCount: number;
      overview: { ticketsShipped: { count: number }; ticketsClosed: { count: number }; totalCost: number };
    };

    expect(allCompletedResponse.status).toBe(200);
    expect(allCompleted.jobCount).toBe(4);
    expect(allCompleted.overview.ticketsShipped.count).toBe(2);
    expect(allCompleted.overview.ticketsClosed.count).toBe(2);
    expect(allCompleted.overview.totalCost).toBe(7.5);
  });

  it('filters by effective agent and returns only project agents with job history', async () => {
    await seedAnalyticsFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=all-completed&agent=CODEX`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const response = (await responseRaw.json()) as {
      filters: { agent: string; outcome: string };
      jobCount: number;
      availableAgents: Array<{ value: string; label: string; jobCount: number }>;
      overview: { totalCost: number; ticketsShipped: { count: number }; ticketsClosed: { count: number } };
    };

    expect(responseRaw.status).toBe(200);
    expect(response.filters.agent).toBe('CODEX');
    expect(response.jobCount).toBe(2);
    expect(response.overview.totalCost).toBe(2.5);
    expect(response.overview.ticketsShipped.count).toBe(1);
    expect(response.overview.ticketsClosed.count).toBe(1);
    expect(response.availableAgents).toEqual([
      expect.objectContaining({ value: 'all', jobCount: 5 }),
      expect.objectContaining({ value: 'CLAUDE', label: 'Claude', jobCount: 3 }),
      expect.objectContaining({ value: 'CODEX', label: 'Codex', jobCount: 2 }),
    ]);
  });

  it('returns range-accurate completion metrics and preserves zeroed cards for empty combinations', async () => {
    await seedAnalyticsFixtures(ctx.projectId);

    const shortRangeResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=7d&outcome=all-completed`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const shortRange = (await shortRangeResponse.json()) as {
      overview: { ticketsShipped: { count: number; label: string }; ticketsClosed: { count: number; label: string } };
    };

    expect(shortRangeResponse.status).toBe(200);
    expect(shortRange.overview.ticketsShipped).toEqual({
      count: 2,
      label: 'Last 7 days',
    });
    expect(shortRange.overview.ticketsClosed).toEqual({
      count: 2,
      label: 'Last 7 days',
    });

    const allTimeResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=all&outcome=all-completed`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const allTime = (await allTimeResponse.json()) as {
      overview: { ticketsShipped: { count: number; label: string }; ticketsClosed: { count: number; label: string } };
    };

    expect(allTime.overview.ticketsShipped).toEqual({
      count: 3,
      label: 'All time',
    });
    expect(allTime.overview.ticketsClosed).toEqual({
      count: 2,
      label: 'All time',
    });

    const emptyResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=7d&outcome=shipped&agent=CODEX`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const empty = (await emptyResponse.json()) as {
      jobCount: number;
      hasData: boolean;
      overview: { ticketsShipped: { count: number }; ticketsClosed: { count: number } };
    };

    expect(emptyResponse.status).toBe(200);
    expect(empty.jobCount).toBe(1);
    expect(empty.hasData).toBe(true);
    expect(empty.overview.ticketsShipped.count).toBe(1);
    expect(empty.overview.ticketsClosed.count).toBe(0);

    const noMatchResponse = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=7d&outcome=closed&agent=CODEX`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const noMatch = (await noMatchResponse.json()) as {
      jobCount: number;
      hasData: boolean;
      overview: { ticketsShipped: { count: number }; ticketsClosed: { count: number } };
    };

    expect(noMatchResponse.status).toBe(200);
    expect(noMatch.jobCount).toBe(1);
    expect(noMatch.hasData).toBe(false);
    expect(noMatch.overview.ticketsShipped.count).toBe(0);
    expect(noMatch.overview.ticketsClosed.count).toBe(1);
  });

  it('keeps Gemini jobs visible in analytics totals while unsupported pricing marks costs incomplete', async () => {
    await seedGeminiAnalyticsFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=all-completed&agent=GEMINI`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const response = (await responseRaw.json()) as {
      jobCount: number;
      overview: { totalCost: number; costsIncomplete: boolean };
      tokenUsage: { inputTokens: number; outputTokens: number; thinkingTokens: number; cacheTokens: number };
      topTools: Array<{ tool: string; count: number }>;
    };

    expect(responseRaw.status).toBe(200);
    expect(response.jobCount).toBe(2);
    expect(response.overview.totalCost).toBe(1.11);
    expect(response.overview.costsIncomplete).toBe(true);
    expect(response.tokenUsage).toEqual({
      inputTokens: 1800,
      outputTokens: 450,
      thinkingTokens: 220,
      cacheTokens: 160,
    });
    expect(response.topTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: 'shell', count: 1 }),
        expect.objectContaining({ tool: 'read_file', count: 1 }),
      ])
    );
  });

  it('derives availableAgents from the shared supported-agent source plus project history', async () => {
    await seedGeminiAnalyticsFixtures(ctx.projectId);

    const responseRaw = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=all-completed`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const response = (await responseRaw.json()) as {
      availableAgents: Array<{ value: string; label: string; jobCount: number; isDefault: boolean }>;
    };

    expect(responseRaw.status).toBe(200);
    expect(response.availableAgents).toEqual([
      { value: 'all', label: 'All agents', jobCount: 3, isDefault: true },
      { value: 'CODEX', label: 'Codex', jobCount: 1, isDefault: false },
      { value: 'GEMINI', label: 'Gemini', jobCount: 2, isDefault: false },
    ]);
  });

  it('returns peakContextDistribution rows scoped to filtered completed jobs (AIB-725)', async () => {
    await seedAnalyticsFixtures(ctx.projectId);

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Augment the seeded jobs with peak/avg/turnCount and Claude/Mistral models
    const jobs = await prisma.job.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { id: 'asc' },
    });

    // Job 1 (E2E-1, implement, FULL, COMPLETED) — Claude, peak=120k of 200k window (60%)
    await prisma.job.update({
      where: { id: jobs[0]!.id },
      data: {
        model: 'claude-sonnet-4-6',
        peakContextTokens: 120_000,
        avgContextTokens: 80_000,
        turnCount: 5,
        qualityScore: 92,
      },
    });
    // Job 2 (E2E-2, verify, QUICK, COMPLETED) — Claude, peak=180k (90%)
    await prisma.job.update({
      where: { id: jobs[1]!.id },
      data: {
        model: 'claude-sonnet-4-6',
        peakContextTokens: 180_000,
        avgContextTokens: 150_000,
        turnCount: 3,
        qualityScore: 60,
      },
    });
    // Add a Mistral ticket + job to the same project (no peakContextTokens)
    const mistralTicket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] Mistral analytics ticket',
        description: 'mistral peak context test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.QUICK,
        ticketNumber: 9,
        ticketKey: 'E2E-9',
        updatedAt: daysAgo(1),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: mistralTicket.id,
        projectId: ctx.projectId,
        command: 'quick-impl',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        updatedAt: daysAgo(1),
        model: 'mistral-large-latest',
        peakContextTokens: null,
        avgContextTokens: null,
        turnCount: null,
        toolsUsed: [],
      },
    });

    const responseRaw = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=shipped`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const response = (await responseRaw.json()) as {
      peakContextDistribution: {
        jobs: Array<{
          jobId: number;
          peakContextTokens: number | null;
          model: string | null;
          command: string;
          workflowType: string;
          qualityScore: number | null;
        }>;
        hasData: boolean;
      };
    };

    expect(responseRaw.status).toBe(200);
    expect(response.peakContextDistribution.hasData).toBe(true);

    // shipped + 30d: E2E-1 (FULL) + E2E-2 (QUICK) + E2E-9 (QUICK Mistral) = 3 jobs
    expect(response.peakContextDistribution.jobs).toHaveLength(3);

    const claudeJob1 = response.peakContextDistribution.jobs.find(
      (j) => j.peakContextTokens === 120_000
    );
    expect(claudeJob1).toEqual(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        command: 'implement',
        workflowType: 'FULL',
        qualityScore: 92,
      })
    );

    const mistralJob = response.peakContextDistribution.jobs.find(
      (j) => j.model === 'mistral-large-latest'
    );
    expect(mistralJob).toEqual(
      expect.objectContaining({
        peakContextTokens: null,
        command: 'quick-impl',
        workflowType: 'QUICK',
      })
    );
  });

  it('returns hasData=false when every filtered job has null peakContextTokens (AIB-725)', async () => {
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Mistral-only project: no peak data anywhere
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] mistral-only project',
        description: 'mistral peak null test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.QUICK,
        ticketNumber: 21,
        ticketKey: 'E2E-21',
        updatedAt: daysAgo(1),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'quick-impl',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        updatedAt: daysAgo(1),
        model: 'mistral-large-latest',
        peakContextTokens: null,
        avgContextTokens: null,
        turnCount: null,
        toolsUsed: [],
      },
    });

    const responseRaw = await GET(
      new NextRequest(`http://localhost/api/projects/${ctx.projectId}/analytics?outcome=shipped`),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const response = (await responseRaw.json()) as {
      peakContextDistribution: { jobs: unknown[]; hasData: boolean };
    };

    expect(responseRaw.status).toBe(200);
    expect(response.peakContextDistribution.hasData).toBe(false);
    expect(response.peakContextDistribution.jobs.length).toBeGreaterThan(0);
  });

  it('rejects invalid analytics filters', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?outcome=invalid`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid analytics filters');
  });
});
