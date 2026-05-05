/**
 * Integration tests for GET /api/projects/[projectId]/drift (US1, US3).
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/drift/route';
import type { DriftDashboardSnapshot } from '@/lib/drift/types';

const prisma = getPrismaClient();

// Mock ownership check — default to passing
const mockVerifyProjectOwnership = vi.fn(async () => ({
  id: 1,
  name: 'test',
  githubOwner: 'test',
  githubRepo: 'test',
  clarificationPolicy: 'AUTO' as const,
  defaultBranch: 'main',
}));

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args),
  verifyProjectAccess: vi.fn(async () => undefined),
}));

function makeRequest(projectId: number, params?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost/api/projects/${projectId}/drift`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url.toString(), {
    headers: { 'x-test-user-id': 'test-user-id' },
  });
}

async function callRoute(projectId: number, params?: Record<string, string>) {
  const req = makeRequest(projectId, params);
  const response = await GET(req, {
    params: Promise.resolve({ projectId: String(projectId) }),
  });
  return { response, data: await response.json() };
}

async function seedPairing(
  ticketId: number,
  projectId: number,
  analysisId: number,
  outcomeId: number,
  overrides: Partial<{
    frictionPredictedLow: boolean;
    frictionMatch: boolean;
    costInRange: boolean | null;
    qualityInRange: boolean | null;
    pendingOutcome: boolean;
    unpairedReason: string | null;
  }> = {}
) {
  return prisma.analysisOutcomePairing.create({
    data: {
      ticketId,
      projectId,
      analysisId,
      outcomeId,
      shippedAt: new Date(),
      predictedFriction: 'low',
      actualFrictionFree: overrides.frictionMatch ?? true,
      frictionPredictedLow: overrides.frictionPredictedLow ?? true,
      frictionMatch: overrides.frictionMatch ?? true,
      frictionEmerged: false,
      frictionIncomparable: false,
      costInRange: overrides.costInRange ?? true,
      costIncomparable: overrides.costInRange === null,
      qualityInRange: overrides.qualityInRange ?? true,
      qualityIncomparable: overrides.qualityInRange === null,
      predictedRecommendation: 'FULL',
      actualWorkflowType: 'FULL',
      recommendationMatch: true,
      recommendationIncomparable: false,
      pendingOutcome: overrides.pendingOutcome ?? false,
      unpairedReason: overrides.unpairedReason ?? null,
    },
  });
}

describe('Drift Route — owner access', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    mockVerifyProjectOwnership.mockResolvedValue({
      id: ctx.projectId,
      name: 'test',
      githubOwner: 'test',
      githubRepo: 'test',
      clarificationPolicy: 'AUTO' as const,
      defaultBranch: 'main',
    });
  });

  it('owner gets 200 with snapshot', async () => {
    const { response, data } = await callRoute(ctx.projectId);
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('projectId', ctx.projectId);
    expect(data).toHaveProperty('sampleSize');
    expect(data).toHaveProperty('friction');
    expect(data).toHaveProperty('cost');
    expect(data).toHaveProperty('quality');
    expect(data).toHaveProperty('usage');
    expect(data).toHaveProperty('recentPairings');
  });

  it('member → 404 (FR-007)', async () => {
    mockVerifyProjectOwnership.mockRejectedValueOnce(new Error('Project not found'));
    const { response } = await callRoute(ctx.projectId);
    expect(response.status).toBe(404);
  });

  it('non-member → 404', async () => {
    mockVerifyProjectOwnership.mockRejectedValueOnce(new Error('Project not found'));
    const { response } = await callRoute(ctx.projectId);
    expect(response.status).toBe(404);
  });

  it('invalid pageSize → 400', async () => {
    const { response } = await callRoute(ctx.projectId, { pageSize: 'bad' });
    expect(response.status).toBe(400);
  });

  it('pageSize out of range → 400', async () => {
    const { response } = await callRoute(ctx.projectId, { pageSize: '999' });
    expect(response.status).toBe(400);
  });
});

describe('Drift Route — invariants on seeded data', () => {
  let ctx: TestContext;
  let userId: string;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const user = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    userId = user!.id;
    mockVerifyProjectOwnership.mockResolvedValue({
      id: ctx.projectId,
      name: 'test',
      githubOwner: 'test',
      githubRepo: 'test',
      clarificationPolicy: 'AUTO' as const,
      defaultBranch: 'main',
    });
  });

  async function createShippedTicketWithPairing(
    num: number,
    pairingOverrides: Parameters<typeof seedPairing>[4] = {}
  ) {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] drift route ${num}`,
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: num,
        ticketKey: `DR-${num}-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    const analysis = await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: `[e2e] drift route ${num}`,
        descriptionSnapshot: 'test',
        stackSnapshot: {},
        startedAt: new Date(),
      },
    });
    const outcome = await prisma.ticketOutcome.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        workflowType: WorkflowType.FULL,
        shippedAt: new Date(),
        ruleSetVersion: 1,
        frictionFree: true,
        frictionJobCount: 0,
        pipelineJobCount: 1,
        totalJobCount: 1,
        jobCountByPrefix: {},
        toolsUsed: [],
        domains: [],
        domainFileCounts: {},
        filesTouched: [],
      },
    });
    await seedPairing(ticket.id, ctx.projectId, analysis.id, outcome.id, pairingOverrides);
    return { ticket, analysis, outcome };
  }

  it('empty state — sampleSize=0', async () => {
    const { data } = await callRoute(ctx.projectId);
    expect((data as DriftDashboardSnapshot).sampleSize).toBe(0);
    expect((data as DriftDashboardSnapshot).friction.matrix).toEqual({ tp: 0, fp: 0, tn: 0, fn: 0 });
  });

  it('invariant I1: friction matrix + incomparable == sampleSize', async () => {
    await createShippedTicketWithPairing(800);
    await createShippedTicketWithPairing(801);
    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    const { tp, fp, tn, fn } = snap.friction.matrix;
    expect(tp + fp + tn + fn + snap.friction.incomparable).toBe(snap.sampleSize);
  });

  it('invariant I2: cost totals == sampleSize', async () => {
    await createShippedTicketWithPairing(802);
    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    expect(
      snap.cost.inRange + snap.cost.under + snap.cost.over + snap.cost.incomparable
    ).toBe(snap.sampleSize);
  });

  it('invariant I3: quality totals == sampleSize', async () => {
    await createShippedTicketWithPairing(803);
    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    expect(
      snap.quality.inRange + snap.quality.under + snap.quality.over + snap.quality.incomparable
    ).toBe(snap.sampleSize);
  });

  it('unpairedReason set → excluded from sampleSize but counted in unpairedCount', async () => {
    await createShippedTicketWithPairing(804);
    await createShippedTicketWithPairing(805, { unpairedReason: 'outcome_missing_24h' });
    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    expect(snap.sampleSize).toBe(1);
    expect(snap.unpairedCount).toBeGreaterThanOrEqual(1);
  });

  it('pendingOutcome row excluded from sampleSize, counted in pendingCount', async () => {
    await createShippedTicketWithPairing(806, { pendingOutcome: true });
    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    expect(snap.sampleSize).toBe(0);
    expect(snap.pendingCount).toBeGreaterThanOrEqual(1);
  });

  // T025 — explicit owner-only cases (US3)
  it('US3: anonymous → 401', async () => {
    mockVerifyProjectOwnership.mockRejectedValueOnce(new Error('Unauthorized'));
    const req = new NextRequest(
      `http://localhost/api/projects/${ctx.projectId}/drift`,
      { headers: {} }
    );
    const res = await GET(req, {
      params: Promise.resolve({ projectId: String(ctx.projectId) }),
    });
    expect(res.status).toBe(401);
  });

  it('US3: cross-project isolation — owner of A querying project B → 404 (I7, SC-006)', async () => {
    mockVerifyProjectOwnership.mockRejectedValueOnce(new Error('Project not found'));
    const { response } = await callRoute(ctx.projectId + 9999);
    expect(response.status).toBe(404);
  });

  it('precision null when tp+fp=0', async () => {
    // FN: predicted low, actual frictionFree=false
    await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] drift route fn',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 807,
        ticketKey: `DR-807-${Date.now()}`,
        updatedAt: new Date(),
      },
    }).then(async (ticket) => {
      const analysis = await prisma.ticketAnalysis.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          userId,
          status: 'success',
          ruleSetVersion: 1,
          agent: 'CLAUDE',
          titleSnapshot: '[e2e] fn test',
          descriptionSnapshot: 'test',
          stackSnapshot: {},
          startedAt: new Date(),
        },
      });
      const outcome = await prisma.ticketOutcome.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          workflowType: WorkflowType.FULL,
          shippedAt: new Date(),
          ruleSetVersion: 1,
          frictionFree: false,
          frictionJobCount: 1,
          pipelineJobCount: 1,
          totalJobCount: 2,
          jobCountByPrefix: {},
          toolsUsed: [],
          domains: [],
          domainFileCounts: {},
          filesTouched: [],
        },
      });
      await prisma.analysisOutcomePairing.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          analysisId: analysis.id,
          outcomeId: outcome.id,
          shippedAt: new Date(),
          predictedFriction: 'low',
          actualFrictionFree: false,
          frictionPredictedLow: true,
          frictionMatch: false,
          frictionEmerged: true,
          frictionIncomparable: false,
          costInRange: true,
          costIncomparable: false,
          qualityInRange: true,
          qualityIncomparable: false,
          predictedRecommendation: 'FULL',
          actualWorkflowType: 'FULL',
          recommendationMatch: true,
          recommendationIncomparable: false,
          pendingOutcome: false,
          unpairedReason: null,
        },
      });
    });

    const { data } = await callRoute(ctx.projectId);
    const snap = data as DriftDashboardSnapshot;
    // FN only → tp=0, fp=0 → precision=null (I4)
    expect(snap.friction.precision).toBeNull();
  });
});
