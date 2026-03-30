import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Quality Gate Aggregation + API Response', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  async function createShipTicketWithScore(
    score: number,
    completedAt: Date,
    details?: string,
  ) {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] Ship Ticket Score ${score}`,
        description: 'Test ticket',
        stage: 'SHIP',
        ticketKey: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        updatedAt: new Date(),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: score,
        qualityScoreDetails: details ?? null,
        completedAt,
        updatedAt: new Date(),
      },
    });
    return ticket;
  }

  it('returns correct average, distribution, and dimensions for SHIP tickets with scores', async () => {
    const now = new Date();
    const scores = [95, 82, 74, 61, 45];
    const details = JSON.stringify({
      dimensions: [
        { name: 'Compliance', agentId: 'compliance', score: 80, weight: 0.40, weightedScore: 32 },
        { name: 'Bug Detection', agentId: 'bug-detection', score: 70, weight: 0.30, weightedScore: 21 },
        { name: 'Code Comments', agentId: 'code-comments', score: 60, weight: 0.20, weightedScore: 12 },
        { name: 'Historical Context', agentId: 'historical-context', score: 50, weight: 0.10, weightedScore: 5 },
        { name: 'Spec Sync', agentId: 'spec-sync', score: 40, weight: 0.00, weightedScore: 0 },
      ],
      threshold: 'Good',
      computedAt: now.toISOString(),
    });

    for (const score of scores) {
      await createShipTicketWithScore(
        score,
        new Date(now.getTime() - Math.random() * 20 * 24 * 60 * 60 * 1000),
        details,
      );
    }

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(response.status).toBe(200);

    const qg = data.modules.qualityGate;
    expect(qg.passive).toBe(true);
    expect(qg.ticketCount).toBe(5);
    // Average: (95+82+74+61+45)/5 = 71.4 → 71
    expect(qg.score).toBe(71);
    expect(qg.distribution.excellent).toBe(1); // 95
    expect(qg.distribution.good).toBe(2);      // 82, 74
    expect(qg.distribution.fair).toBe(1);      // 61
    expect(qg.distribution.poor).toBe(1);      // 45

    // Dimensions should be averages
    expect(qg.detail).not.toBeNull();
    expect(qg.detail.dimensions).toHaveLength(5);
    const compliance = qg.detail.dimensions.find((d: { name: string }) => d.name === 'Compliance');
    expect(compliance.averageScore).toBe(80);
  });

  it('returns empty state when no qualifying tickets exist', async () => {
    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const qg = data.modules.qualityGate;
    expect(qg.score).toBeNull();
    expect(qg.ticketCount).toBe(0);
    expect(qg.summary).toBe('No qualifying tickets');
    expect(qg.trend.type).toBe('no_data');
    expect(qg.distribution).toEqual({ excellent: 0, good: 0, fair: 0, poor: 0 });
    expect(qg.detail).toBeNull();
  });

  it('shows trend when both current and previous periods have data', async () => {
    const now = new Date();
    // Current period: score 80
    await createShipTicketWithScore(80, new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
    // Previous period: score 60
    await createShipTicketWithScore(60, new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000));

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const trend = data.modules.qualityGate.trend;
    expect(trend.type).toBe('improvement');
    expect(trend.delta).toBe(20);
    expect(trend.previousAverage).toBe(60);
  });

  it('shows "new" trend when only current period has data', async () => {
    const now = new Date();
    await createShipTicketWithScore(75, new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    const trend = data.modules.qualityGate.trend;
    expect(trend.type).toBe('new');
    expect(trend.delta).toBeNull();
  });

  it('uses most recent verify job when multiple exist per ticket', async () => {
    const now = new Date();
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] Multi-verify ticket',
        description: 'Test',
        stage: 'SHIP',
        ticketKey: `TST-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    // Older verify job with score 50
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 50,
        completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });

    // Newer verify job with score 90
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 90,
        completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Should use the newer score (90), not the older (50)
    expect(data.modules.qualityGate.ticketCount).toBe(1);
    expect(data.modules.qualityGate.score).toBe(90);
  });
});

describe('Quality Gate Global Score Integration', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  it('includes QG in global score with all 5 modules', async () => {
    // Seed health scores for active modules
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        complianceScore: 90,
        testsScore: 70,
        specSyncScore: 85,
        lastSecurityScan: new Date(),
        lastComplianceScan: new Date(),
        lastTestsScan: new Date(),
        lastSpecSyncScan: new Date(),
      },
    });

    // Create a SHIP ticket with quality score for QG
    const now = new Date();
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] QG Global Score Test',
        description: 'Test',
        stage: 'SHIP',
        ticketKey: `TST-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 75,
        completedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Global score: (80+90+70+85+75)/5 = 80
    expect(data.globalScore).toBe(80);
  });

  it('redistributes weight when QG has no data', async () => {
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        complianceScore: 90,
        lastSecurityScan: new Date(),
        lastComplianceScan: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Only security (80) + compliance (90) = 85
    expect(data.globalScore).toBe(85);
  });

  it('excludes QG when no qualifying tickets and redistributes', async () => {
    await prisma.healthScore.create({
      data: {
        projectId: ctx.projectId,
        securityScore: 80,
        lastSecurityScan: new Date(),
      },
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    // Only security: 80
    expect(data.globalScore).toBe(80);
  });
});
