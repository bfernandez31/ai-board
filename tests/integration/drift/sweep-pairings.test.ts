/**
 * Integration tests for POST /api/maintenance/sweep-unpaired-pairings (Phase 7).
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/maintenance/sweep-unpaired-pairings/route';

const prisma = getPrismaClient();
const VALID_TOKEN = 'test-workflow-token';

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  verifyWorkflowToken: vi.fn(async (req: Request) => {
    const auth = req.headers.get('authorization') ?? '';
    return auth === `Bearer ${VALID_TOKEN}`;
  }),
}));

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return new NextRequest('http://localhost/api/maintenance/sweep-unpaired-pairings', {
    method: 'POST',
    headers,
  });
}

describe('Sweep pairings endpoint — auth', () => {
  it('401 without token', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('401 with wrong token', async () => {
    const res = await POST(makeRequest('wrong-token'));
    expect(res.status).toBe(401);
  });

  it('200 with valid token', async () => {
    const res = await POST(makeRequest(VALID_TOKEN));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('examinedPending');
    expect(data).toHaveProperty('pairedNow');
    expect(data).toHaveProperty('expired');
    expect(data).toHaveProperty('windowHours', 24);
  });
});

describe('Sweep pairings endpoint — behavior', () => {
  let ctx: TestContext;
  let userId: string;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const user = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    userId = user!.id;
  });

  it('pendingOutcome rows whose outcome has arrived → pairedNow increments', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] sweep pending',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 950,
        ticketKey: `SW-950-${Date.now()}`,
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
        titleSnapshot: '[e2e] sweep pending',
        descriptionSnapshot: 'test',
        stackSnapshot: {},
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 70, upper: 90 },
          recommendation: { choice: 'FULL', confidence: 'high', justification: 'test' },
          costRange: {
            baselineLowerUsd: 1.0,
            baselineUpperUsd: 3.0,
            marginalFrictionLowerUsd: 3.0,
            marginalFrictionUpperUsd: 5.0,
          },
          scopeWarnings: [],
          anchors: [],
        },
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

    // Insert a pending pairing row
    await prisma.analysisOutcomePairing.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        analysisId: analysis.id,
        shippedAt: new Date(),
        pendingOutcome: true,
        unpairedReason: null,
        predictedFriction: 'low',
        actualFrictionFree: false,
        frictionPredictedLow: false,
        frictionMatch: false,
        frictionEmerged: false,
        frictionIncomparable: true,
        costIncomparable: true,
        qualityIncomparable: true,
        predictedRecommendation: 'FULL',
        actualWorkflowType: 'FULL',
        recommendationMatch: false,
        recommendationIncomparable: true,
      },
    });

    // The outcome arrived — run sweep
    const res = await POST(makeRequest(VALID_TOKEN));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pairedNow).toBeGreaterThanOrEqual(1);

    // Verify row is now paired
    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row!.pendingOutcome).toBe(false);
    expect(row!.unpairedReason).toBeNull();
    expect(row!.outcomeId).toBe(outcome.id);
  });

  it('rows past 24h with no outcome → unpairedReason=outcome_missing_24h', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] sweep expired',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 951,
        ticketKey: `SW-951-${Date.now()}`,
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
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
        titleSnapshot: '[e2e] sweep expired',
        descriptionSnapshot: 'test',
        stackSnapshot: {},
        startedAt: new Date(),
      },
    });

    // Insert a pending row with shippedAt 25h ago
    await prisma.analysisOutcomePairing.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        analysisId: analysis.id,
        shippedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        pendingOutcome: true,
        unpairedReason: null,
        predictedFriction: 'low',
        actualFrictionFree: false,
        frictionPredictedLow: false,
        frictionMatch: false,
        frictionEmerged: false,
        frictionIncomparable: true,
        costIncomparable: true,
        qualityIncomparable: true,
        predictedRecommendation: 'FULL',
        actualWorkflowType: 'FULL',
        recommendationMatch: false,
        recommendationIncomparable: true,
      },
    });

    const res = await POST(makeRequest(VALID_TOKEN));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.expired).toBeGreaterThanOrEqual(1);

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row!.pendingOutcome).toBe(false);
    expect(row!.unpairedReason).toBe('outcome_missing_24h');
  });
});
