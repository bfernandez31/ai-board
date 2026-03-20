import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/analytics/route';
import type { QualityScoreAnalytics } from '@/lib/analytics/types';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Analytics Route - Quality Score', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const qualityScoreDetails = JSON.stringify({
    version: 1,
    qualityScore: 82,
    threshold: 'Good',
    computedAt: '2026-03-17T10:30:00Z',
    dimensions: [
      { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.3, weightedScore: 25.5 },
      { name: 'Compliance', agentId: 'compliance', score: 90, weight: 0.4, weightedScore: 36 },
      { name: 'Code Comments', agentId: 'code-comments', score: 70, weight: 0.2, weightedScore: 14 },
      { name: 'Historical Context', agentId: 'historical-context', score: 60, weight: 0.1, weightedScore: 6 },
      { name: 'Spec Sync', agentId: 'spec-sync', score: 80, weight: 0, weightedScore: 0 },
    ],
  });

  const qualityScoreDetails2 = JSON.stringify({
    version: 1,
    qualityScore: 72,
    threshold: 'Good',
    computedAt: '2026-03-16T10:30:00Z',
    dimensions: [
      { name: 'Bug Detection', agentId: 'bug-detection', score: 75, weight: 0.3, weightedScore: 22.5 },
      { name: 'Compliance', agentId: 'compliance', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'Code Comments', agentId: 'code-comments', score: 60, weight: 0.2, weightedScore: 12 },
      { name: 'Historical Context', agentId: 'historical-context', score: 50, weight: 0.1, weightedScore: 5 },
      { name: 'PR Comments', agentId: 'pr-comments', score: 70, weight: 0.1, weightedScore: 7 },
    ],
  });

  async function seedQualityScoreFixtures(projectId: number) {
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
          qualityScoreDetails,
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
          qualityScoreDetails: qualityScoreDetails2,
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

    // Dimension comparison keeps both new and historical fifth-dimension labels readable
    expect(data.qualityScore.dimensionComparison).toHaveLength(6);
    const bugDetection = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Bug Detection'
    );
    expect(bugDetection).toBeDefined();
    expect(bugDetection!.averageScore).toBe(80); // (85 + 75) / 2
    expect(bugDetection!.weight).toBe(0.3);

    const compliance = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Compliance'
    );
    expect(compliance?.weight).toBe(0.4);

    const specSync = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'Spec Sync'
    );
    expect(specSync).toMatchObject({
      averageScore: 80,
      weight: 0,
      displayOrder: 5,
    });

    const prComments = data.qualityScore.dimensionComparison.find(
      (d) => d.dimension === 'PR Comments'
    );
    expect(prComments).toMatchObject({
      averageScore: 70,
      weight: 0.1,
      displayOrder: 5,
    });
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
