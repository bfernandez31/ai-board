import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/quality-gate/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Quality Gate Details GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/quality-gate`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  let ticketCounter = 0;

  async function createShipTicket(overrides: {
    title?: string;
    workflowType?: string;
    stage?: string;
  } = {}) {
    ticketCounter++;
    const num = 9000 + ticketCounter + Math.floor(Math.random() * 1000);
    return prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        ticketNumber: num,
        ticketKey: `E2E-${num}`,
        title: overrides.title ?? '[e2e] QG test ticket',
        description: '[e2e] Quality gate test ticket',
        workflowType: overrides.workflowType ?? 'FULL',
        stage: overrides.stage ?? 'SHIP',
      },
    });
  }

  async function createVerifyJob(ticketId: number, overrides: {
    qualityScore?: number | null;
    qualityScoreDetails?: string | null;
    completedAt?: Date;
    status?: string;
  } = {}) {
    return prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        updatedAt: new Date(),
        status: overrides.status ?? 'COMPLETED',
        qualityScore: overrides.qualityScore ?? 80,
        qualityScoreDetails: overrides.qualityScoreDetails ?? null,
        completedAt: overrides.completedAt ?? new Date(),
      },
    });
  }

  it('returns empty state when no qualifying tickets exist', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.averageScore).toBeNull();
    expect(data.ticketCount).toBe(0);
    expect(data.trend).toBeNull();
    expect(data.trendDelta).toBeNull();
    expect(data.distribution).toEqual({ excellent: 0, good: 0, fair: 0, poor: 0 });
    expect(data.dimensions).toHaveLength(5);
    expect(data.dimensions.every((d: { averageScore: number | null }) => d.averageScore === null)).toBe(true);
    expect(data.recentTickets).toEqual([]);
    expect(data.trendData).toEqual([]);
  });

  it('returns correct 30-day average from multiple SHIP tickets', async () => {
    const ticket1 = await createShipTicket({ title: '[e2e] Ticket 1' });
    const ticket2 = await createShipTicket({ title: '[e2e] Ticket 2' });
    const ticket3 = await createShipTicket({ title: '[e2e] Ticket 3' });

    await createVerifyJob(ticket1.id, { qualityScore: 90 });
    await createVerifyJob(ticket2.id, { qualityScore: 80 });
    await createVerifyJob(ticket3.id, { qualityScore: 70 });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.averageScore).toBe(80); // (90+80+70)/3
    expect(data.ticketCount).toBe(3);
    expect(data.distribution).toEqual({ excellent: 1, good: 2, fair: 0, poor: 0 });
  });

  it('excludes QUICK-workflow tickets from calculation', async () => {
    const fullTicket = await createShipTicket({ workflowType: 'FULL' });
    const quickTicket = await createShipTicket({ workflowType: 'QUICK' });

    await createVerifyJob(fullTicket.id, { qualityScore: 90 });
    await createVerifyJob(quickTicket.id, { qualityScore: 40 });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.averageScore).toBe(90);
    expect(data.ticketCount).toBe(1);
  });

  it('excludes tickets not at SHIP stage', async () => {
    const shipTicket = await createShipTicket({ stage: 'SHIP' });
    const buildTicket = await createShipTicket({ stage: 'BUILD' });

    await createVerifyJob(shipTicket.id, { qualityScore: 85 });
    await createVerifyJob(buildTicket.id, { qualityScore: 40 });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.averageScore).toBe(85);
    expect(data.ticketCount).toBe(1);
  });

  it('computes correct trend comparing 30-day windows', async () => {
    // Previous period (40 days ago)
    const oldTicket = await createShipTicket({ title: '[e2e] Old ticket' });
    await createVerifyJob(oldTicket.id, {
      qualityScore: 70,
      completedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    // Current period (5 days ago)
    const newTicket = await createShipTicket({ title: '[e2e] New ticket' });
    await createVerifyJob(newTicket.id, {
      qualityScore: 85,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.trend).toBe('up');
    expect(data.trendDelta).toBe(15);
  });

  it('computes per-dimension averages from qualityScoreDetails', async () => {
    const details = JSON.stringify({
      dimensions: [
        { agentId: 'compliance', name: 'Compliance', score: 88, weight: 0.30, weightedScore: 26.4 },
        { agentId: 'bug-detection', name: 'Bug Detection', score: 79, weight: 0.30, weightedScore: 23.7 },
        { agentId: 'product-contract-sync', name: 'Product Contract Sync', score: 75, weight: 0.20, weightedScore: 15 },
        { agentId: 'edge-cases-failure-modes', name: 'Edge Cases & Failure Modes', score: 70, weight: 0.15, weightedScore: 10.5 },
        { agentId: 'historical-context', name: 'Historical Context', score: 65, weight: 0.05, weightedScore: 3.25 },
      ],
      threshold: 'Good',
      computedAt: new Date().toISOString(),
    });

    const ticket = await createShipTicket();
    await createVerifyJob(ticket.id, { qualityScore: 82, qualityScoreDetails: details });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.dimensions).toHaveLength(5);
    expect(data.dimensions[0]).toEqual({ name: 'Compliance', averageScore: 88, weight: 0.30 });
    expect(data.dimensions[1]).toEqual({ name: 'Bug Detection', averageScore: 79, weight: 0.30 });
  });

  it('returns recent tickets list ordered by completedAt desc', async () => {
    const ticket1 = await createShipTicket({ title: '[e2e] First' });
    const ticket2 = await createShipTicket({ title: '[e2e] Second' });

    await createVerifyJob(ticket1.id, {
      qualityScore: 80,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
    await createVerifyJob(ticket2.id, {
      qualityScore: 90,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.recentTickets).toHaveLength(2);
    expect(data.recentTickets[0].title).toBe('[e2e] Second');
    expect(data.recentTickets[0].score).toBe(90);
    expect(data.recentTickets[1].title).toBe('[e2e] First');
    expect(data.recentTickets[1].score).toBe(80);
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/quality-gate'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
