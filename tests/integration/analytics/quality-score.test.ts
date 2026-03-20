import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/analytics/route';
import type { QualityScoreAnalytics } from '@/lib/analytics/types';
import { QUALITY_SCORE_DIMENSIONS } from '@/lib/quality-score';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Analytics Route - Quality Score', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  function createQualityScoreDetails(scores: number[]): string {
    return JSON.stringify({
      dimensions: QUALITY_SCORE_DIMENSIONS.map((dimension, index) => ({
        name: dimension.name,
        score: scores[index] ?? 0,
        weight: dimension.weight,
      })),
    });
  }

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function seedQualityScoreFixtures(projectId: number): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    const tickets = await prisma.ticket.createManyAndReturn({
      data: [
        {
          projectId,
          title: '[e2e] scored ticket 1',
          description: 'quality score ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 1,
          ticketKey: 'E2E-1',
          updatedAt: daysAgo(3),
        },
        {
          projectId,
          title: '[e2e] scored ticket 2',
          description: 'quality score ticket',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 2,
          ticketKey: 'E2E-2',
          updatedAt: daysAgo(5),
        },
        {
          projectId,
          title: '[e2e] quick ticket',
          description: 'no quality score',
          stage: Stage.SHIP,
          workflowType: WorkflowType.QUICK,
          ticketNumber: 3,
          ticketKey: 'E2E-3',
          updatedAt: daysAgo(2),
        },
      ],
    });

    const idByKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));

    await prisma.job.createMany({
      data: [
        {
          ticketId: idByKey.get('E2E-1')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          updatedAt: daysAgo(3),
          costUsd: 1.0,
          durationMs: 1000,
          inputTokens: 100,
          outputTokens: 50,
          qualityScore: 82,
          qualityScoreDetails: createQualityScoreDetails([90, 85, 70, 60, 80]),
        },
        {
          ticketId: idByKey.get('E2E-2')!,
          projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(5),
          completedAt: daysAgo(5),
          updatedAt: daysAgo(5),
          costUsd: 1.5,
          durationMs: 2000,
          inputTokens: 200,
          outputTokens: 60,
          qualityScore: 72,
          qualityScoreDetails: createQualityScoreDetails([80, 75, 60, 50, 70]),
        },
        {
          ticketId: idByKey.get('E2E-3')!,
          projectId,
          command: 'quick-impl',
          status: JobStatus.COMPLETED,
          startedAt: daysAgo(2),
          completedAt: daysAgo(2),
          updatedAt: daysAgo(2),
          costUsd: 0.5,
          durationMs: 500,
          inputTokens: 50,
          outputTokens: 30,
        },
      ],
    });
  }

  it('returns quality score aggregations for scored verify jobs', async () => {
    await seedQualityScoreFixtures(ctx.projectId);

    const response = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=30d&outcome=shipped`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const data = (await response.json()) as {
      qualityScore: QualityScoreAnalytics;
    };

    expect(response.status).toBe(200);
    expect(data.qualityScore).toBeDefined();
    expect(data.qualityScore.totalScoredJobs).toBe(2);
    expect(data.qualityScore.overallAverage).toBe(77); // (82 + 72) / 2

    // Score trend has entries sorted by date
    expect(data.qualityScore.scoreTrend.length).toBeGreaterThanOrEqual(1);
    for (const point of data.qualityScore.scoreTrend) {
      expect(point.averageScore).toBeGreaterThanOrEqual(0);
      expect(point.averageScore).toBeLessThanOrEqual(100);
      expect(point.count).toBeGreaterThan(0);
    }

    // Dimension comparison has all 5 dimensions, including zero-weight Spec Sync
    expect(data.qualityScore.dimensionComparison).toHaveLength(5);
    const compliance = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Compliance'
    );
    const bugDetection = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Bug Detection'
    );
    const specSync = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Spec Sync'
    );
    expect(compliance).toBeDefined();
    expect(compliance!.averageScore).toBe(85); // (90 + 80) / 2
    expect(compliance!.weight).toBe(0.4);
    expect(bugDetection).toBeDefined();
    expect(bugDetection!.averageScore).toBe(80); // (85 + 75) / 2
    expect(bugDetection!.weight).toBe(0.3);
    expect(specSync).toBeDefined();
    expect(specSync!.averageScore).toBe(75); // (80 + 70) / 2
    expect(specSync!.weight).toBe(0);
  });

  it('returns empty quality score data when no scored jobs exist', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });

    // Create a ticket with no quality score jobs
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] no score ticket',
        description: 'no quality score',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: 'E2E-1',
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: daysAgo(2),
        completedAt: daysAgo(2),
        updatedAt: daysAgo(2),
        costUsd: 1.0,
        durationMs: 1000,
        inputTokens: 100,
        outputTokens: 50,
      },
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/analytics?range=30d&outcome=shipped`
      ),
      { params: Promise.resolve({ projectId: String(ctx.projectId) }) }
    );
    const data = (await response.json()) as {
      qualityScore: QualityScoreAnalytics;
    };

    expect(response.status).toBe(200);
    expect(data.qualityScore.totalScoredJobs).toBe(0);
    expect(data.qualityScore.overallAverage).toBeNull();
    expect(data.qualityScore.scoreTrend).toEqual([]);
    expect(data.qualityScore.dimensionComparison).toEqual([]);
  });
});
