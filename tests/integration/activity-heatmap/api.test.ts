/**
 * Integration Tests: User Activity Heatmap API
 *
 * Direct-call tests (no HTTP server required) for GET /api/user/activity.
 * Seeds jobs and tickets directly, then invokes the route handler.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/user/activity/route';

vi.mock('@/lib/db/users', () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 'test-user-id',
    email: 'test@e2e.local',
    name: 'E2E Test User',
    source: 'session' as const,
  })),
}));

interface HeatmapResponse {
  startDate: string;
  endDate: string;
  cells: Array<{ date: string; jobCount: number; totalCost: number | null; ticketsShipped: number }>;
  totalJobs: number;
  totalShipped: number;
  availableAgents: Array<{ value: string; label: string; jobCount: number }>;
  availableYears: number[];
  filters: { agent: string; period: { kind: string; year?: number } };
}

describe('GET /api/user/activity', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Ensure the test user's createdAt is well-known
    await prisma.user.upsert({
      where: { email: 'test@e2e.local' },
      update: { createdAt: new Date(Date.UTC(2023, 0, 1)) },
      create: {
        id: 'test-user-id',
        email: 'test@e2e.local',
        name: 'E2E Test User',
        emailVerified: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(Date.UTC(2023, 0, 1)),
      },
    });
  });

  async function seedActivity(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] shipped claude',
          description: 'shipped heatmap',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 101,
          ticketKey: 'E2EH-101',
          updatedAt: daysAgo(2),
        },
        {
          projectId,
          title: '[e2e] explicit codex',
          description: 'codex heatmap',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 102,
          ticketKey: 'E2EH-102',
          updatedAt: daysAgo(3),
          agent: Agent.CODEX,
        },
      ],
    });
    const byKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: byKey.get('E2EH-101')!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.5,
        },
        {
          ticketId: byKey.get('E2EH-101')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: null, // missing cost — should not show "$NaN"
        },
        {
          ticketId: byKey.get('E2EH-102')!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(4),
          completedAt: daysAgo(4),
          updatedAt: daysAgo(4),
          costUsd: 0.75,
        },
        {
          ticketId: byKey.get('E2EH-102')!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 0.25,
        },
      ],
    });
  }

  it('returns heatmap data for the rolling period with job and shipped counts', async () => {
    await seedActivity(ctx.projectId);

    const response = await GET(new NextRequest('http://localhost/api/user/activity'));
    expect(response.status).toBe(200);
    const data = (await response.json()) as HeatmapResponse;

    expect(data.totalJobs).toBe(4);
    // Two ship jobs completed on distinct days → 2 shipped
    expect(data.totalShipped).toBe(2);
    expect(data.filters.period.kind).toBe('rolling');

    // Cell for 3 days ago should have both ship + implement jobs (2 jobs) and 1 shipped
    const cellsWithActivity = data.cells.filter((c) => c.jobCount > 0);
    expect(cellsWithActivity.length).toBeGreaterThan(0);
  });

  it('exposes available years from user account creation (2023) up to current year', async () => {
    const response = await GET(new NextRequest('http://localhost/api/user/activity'));
    const data = (await response.json()) as HeatmapResponse;
    const currentYear = new Date().getUTCFullYear();
    expect(data.availableYears[0]).toBe(currentYear);
    expect(data.availableYears[data.availableYears.length - 1]).toBe(2023);
  });

  it('returns only the "all" option when no jobs exist', async () => {
    const response = await GET(new NextRequest('http://localhost/api/user/activity'));
    const data = (await response.json()) as HeatmapResponse;
    expect(data.availableAgents).toHaveLength(1);
    expect(data.availableAgents[0]!.value).toBe('all');
    expect(data.totalJobs).toBe(0);
    expect(data.totalShipped).toBe(0);
  });

  it('surfaces distinct agents present in the data (effective agent resolution)', async () => {
    await seedActivity(ctx.projectId);
    const response = await GET(new NextRequest('http://localhost/api/user/activity'));
    const data = (await response.json()) as HeatmapResponse;
    const values = data.availableAgents.map((a) => a.value).sort();
    // 'all' plus CLAUDE (from default) and CODEX (from explicit)
    expect(values).toEqual(['CLAUDE', 'CODEX', 'all']);
  });

  it('filters by agent, honoring effective agent resolution via project default', async () => {
    await seedActivity(ctx.projectId);
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity?agent=CLAUDE')
    );
    const data = (await response.json()) as HeatmapResponse;
    // Only the CLAUDE-default ticket's jobs counted (2 jobs)
    expect(data.totalJobs).toBe(2);
    expect(data.totalShipped).toBe(1);
    expect(data.filters.agent).toBe('CLAUDE');
  });

  it('returns 400 when year is out of the user allowed range', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity?year=2000')
    );
    expect(response.status).toBe(400);
  });

  it('returns Jan 1 → Dec 31 grid when a specific year is selected', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/activity?year=2024')
    );
    const data = (await response.json()) as HeatmapResponse;
    expect(data.startDate).toBe('2024-01-01');
    expect(data.endDate).toBe('2024-12-31');
    expect(data.filters.period).toEqual({ kind: 'year', year: 2024 });
    // 2024 is a leap year → 366 days
    expect(data.cells).toHaveLength(366);
  });
});
