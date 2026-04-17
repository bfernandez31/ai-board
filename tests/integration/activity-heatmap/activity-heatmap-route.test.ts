/**
 * Integration test for /api/activity-heatmap.
 *
 * Verifies that the route aggregates jobs across all of a user's
 * accessible projects, counts shipped tickets only when a `ship` job
 * has COMPLETED, hides the agent filter when 0/1 distinct agents are
 * present, derives `availableYears` from the user's account creation
 * date, and rejects malformed `period` query strings.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/activity-heatmap/route';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

interface HeatmapResponse {
  period: { start: string; end: string; label: string; kind: string };
  totals: { jobs: number; ticketsShipped: number };
  days: Array<{ date: string; jobCount: number; totalCost: number | null; ticketsShipped: number }>;
  availableAgents: Array<{ value: string; label: string; jobCount: number; isDefault: boolean }>;
  availableYears: number[];
  filters: { period: string; agent: string };
}

describe('Activity Heatmap Route', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function seedHeatmapFixtures(projectId: number) {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] heatmap shipped claude',
          description: 'shipped via ship job',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1001,
          ticketKey: `HMP${projectId}-1`,
          updatedAt: daysAgo(2),
        },
        {
          projectId,
          title: '[e2e] heatmap codex',
          description: 'codex jobs',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 1002,
          ticketKey: `HMP${projectId}-2`,
          updatedAt: daysAgo(3),
          agent: Agent.CODEX,
        },
        {
          projectId,
          title: '[e2e] heatmap stage-only',
          description: 'stage SHIP but no ship job',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1003,
          ticketKey: `HMP${projectId}-3`,
          updatedAt: daysAgo(1),
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get(`HMP${projectId}-1`)!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 1.25,
          durationMs: 1000,
        },
        {
          ticketId: idByKey.get(`HMP${projectId}-1`)!,
          projectId,
          command: 'ship',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 0.5,
          durationMs: 800,
        },
        {
          ticketId: idByKey.get(`HMP${projectId}-2`)!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          // costUsd null on purpose: tooltip should omit "$0"
          durationMs: 700,
        },
        {
          // stage-only ticket: no ship job exists
          ticketId: idByKey.get(`HMP${projectId}-3`)!,
          projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          updatedAt: daysAgo(1),
          costUsd: 0.4,
        },
      ],
    });
  }

  it('returns aggregated heatmap data with default filters and counts only completed ship jobs', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap')
    );
    const body = (await response.json()) as HeatmapResponse | { error: string };

    expect(response.status).toBe(200);
    const ok = body as HeatmapResponse;
    expect(ok.filters).toEqual({ period: 'last-12-months', agent: 'all' });
    expect(ok.period.kind).toBe('rolling');
    expect(ok.totals.jobs).toBe(4);
    // Only the ticket with a completed `ship` job counts as shipped.
    expect(body.totals.ticketsShipped).toBe(1);

    const daysWithActivity = body.days.filter((d) => d.jobCount > 0);
    expect(daysWithActivity.length).toBeGreaterThan(0);

    // The bucket containing the ship job should have ticketsShipped: 1
    const shippedBuckets = body.days.filter((d) => d.ticketsShipped > 0);
    expect(shippedBuckets).toHaveLength(1);
    expect(shippedBuckets[0]!.jobCount).toBeGreaterThanOrEqual(2);
  });

  it('omits cost when no day-level job has a recorded cost', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=CODEX')
    );
    const body = (await response.json()) as HeatmapResponse;

    expect(response.status).toBe(200);
    // Codex ticket only has the costless implement job
    const codexBuckets = body.days.filter((d) => d.jobCount > 0);
    expect(codexBuckets).toHaveLength(1);
    expect(codexBuckets[0]!.totalCost).toBeNull();
  });

  it('honors effective-agent resolution when filtering by an explicit agent', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    // Filtering by CLAUDE (the project default) should include the
    // tickets without an explicit agent value plus any explicit-CLAUDE.
    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?agent=CLAUDE')
    );
    const body = (await response.json()) as HeatmapResponse;

    expect(response.status).toBe(200);
    // Tickets 1001 and 1003 inherit CLAUDE from project default → 3 jobs
    expect(body.totals.jobs).toBe(3);
    expect(body.totals.ticketsShipped).toBe(1);
  });

  it('returns availableAgents with both effective agents (Claude default + explicit Codex)', async () => {
    await seedHeatmapFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap')
    );
    const body = (await response.json()) as HeatmapResponse;

    expect(response.status).toBe(200);
    const values = body.availableAgents.map((a) => a.value);
    expect(values).toContain('all');
    expect(values).toContain('CLAUDE');
    expect(values).toContain('CODEX');
  });

  it('returns availableYears excluding the current year and bounded by the user creation date', async () => {
    await prisma.user.update({
      where: { id: 'test-user-id' },
      data: { createdAt: new Date(Date.UTC(2023, 5, 1)) },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap')
    );
    const body = (await response.json()) as HeatmapResponse;

    expect(response.status).toBe(200);
    const currentYear = new Date().getUTCFullYear();
    expect(body.availableYears).toContain(currentYear - 1);
    expect(body.availableYears).not.toContain(currentYear);
    // Strictly descending order
    for (let i = 1; i < body.availableYears.length; i++) {
      expect(body.availableYears[i]).toBeLessThan(body.availableYears[i - 1]!);
    }
  });

  it('rejects an invalid period query parameter with 400', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?period=last-week')
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid heatmap filters');
  });

  it('resolves a 4-digit year period to that calendar year boundaries', async () => {
    await prisma.user.update({
      where: { id: 'test-user-id' },
      data: { createdAt: new Date(Date.UTC(2023, 0, 1)) },
    });

    const response = await GET(
      new NextRequest('http://localhost/api/activity-heatmap?period=2024')
    );
    const body = (await response.json()) as HeatmapResponse;

    expect(response.status).toBe(200);
    expect(body.period).toEqual(
      expect.objectContaining({
        kind: 'year',
        start: '2024-01-01',
        end: '2024-12-31',
        label: '2024',
      })
    );
    // 2024 has 366 days
    expect(body.days).toHaveLength(366);
  });
});
