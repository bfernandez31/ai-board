/**
 * Integration tests for analysis–outcome pairing lifecycle (US2).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairAnalysisWithOutcome } from '@/lib/drift/pair';

const prisma = getPrismaClient();

async function seedAnalysis(
  ticketId: number,
  projectId: number,
  userId: string,
  output: unknown = null,
  createdAt?: Date
) {
  return prisma.ticketAnalysis.create({
    data: {
      ticketId,
      projectId,
      userId,
      status: 'success',
      ruleSetVersion: 1,
      agent: 'CLAUDE',
      titleSnapshot: '[e2e] test ticket',
      descriptionSnapshot: 'test description',
      stackSnapshot: {},
      output: output as never,
      createdAt: createdAt ?? new Date(),
      startedAt: new Date(),
    },
  });
}

async function seedOutcome(
  ticketId: number,
  projectId: number,
  workflowType: WorkflowType = WorkflowType.FULL
) {
  return prisma.ticketOutcome.create({
    data: {
      ticketId,
      projectId,
      workflowType,
      shippedAt: new Date(),
      ruleSetVersion: 1,
      totalCostUsd: 2.5,
      qualityScore: 80,
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
}

const validOutput = {
  frictionRisk: 'low',
  qualityGateRange: { lower: 70, upper: 90 },
  recommendation: { choice: 'FULL', confidence: 'high', justification: 'standard' },
  costRange: {
    baselineLowerUsd: 1.0,
    baselineUpperUsd: 3.0,
    marginalFrictionLowerUsd: 3.0,
    marginalFrictionUpperUsd: 5.0,
  },
  scopeWarnings: [],
  anchors: [],
};

describe('Pair on SHIP — lifecycle', () => {
  let ctx: TestContext;
  let userId: string;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const user = await prisma.user.findUnique({ where: { email: 'test@e2e.local' } });
    userId = user!.id;
  });

  afterEach(() => {
    // nothing
  });

  it('ship+analysis+outcome → pairing row created with correct deltas', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test 1',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 900,
        ticketKey: `DF-900-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);
    await seedOutcome(ticket.id, ctx.projectId);

    const result = await pairAnalysisWithOutcome(ticket.id);
    expect(result.paired).toBe(true);

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).not.toBeNull();
    expect(row!.pendingOutcome).toBe(false);
    expect(row!.unpairedReason).toBeNull();
    expect(row!.frictionPredictedLow).toBe(true);
    expect(row!.frictionMatch).toBe(true);
    expect(row!.costInRange).toBe(true);
    expect(row!.qualityInRange).toBe(true);
    expect(row!.recommendationMatch).toBe(true);
  });

  it('ship without analysis → no row created, no error (FR-004)', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test no-analysis',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 901,
        ticketKey: `DF-901-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const result = await pairAnalysisWithOutcome(ticket.id);
    expect(result.paired).toBe(false);
    expect(result.reason).toBe('no_analysis');

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).toBeNull();
  });

  it('ship with analysis but no outcome → pendingOutcome=true row', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test pending',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 902,
        ticketKey: `DF-902-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);

    const result = await pairAnalysisWithOutcome(ticket.id);
    expect(result.paired).toBe(false);
    expect(result.reason).toBe('pending_outcome');

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).not.toBeNull();
    expect(row!.pendingOutcome).toBe(true);
    expect(row!.unpairedReason).toBeNull();
  });

  it('outcome arrives later → row updated to paired', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test late outcome',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 903,
        ticketKey: `DF-903-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);
    // First call: no outcome → pending
    await pairAnalysisWithOutcome(ticket.id);

    // Outcome arrives
    await seedOutcome(ticket.id, ctx.projectId);

    // Second call: outcome now exists → paired
    const result = await pairAnalysisWithOutcome(ticket.id);
    expect(result.paired).toBe(true);

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row!.pendingOutcome).toBe(false);
    expect(row!.unpairedReason).toBeNull();
  });

  it('duplicate SHIP event → idempotent upsert (FR-006)', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test idempotent',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 904,
        ticketKey: `DF-904-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);
    await seedOutcome(ticket.id, ctx.projectId);

    await pairAnalysisWithOutcome(ticket.id);
    const result2 = await pairAnalysisWithOutcome(ticket.id);
    expect(result2.paired).toBe(true);

    const count = await prisma.analysisOutcomePairing.count({
      where: { ticketId: ticket.id },
    });
    expect(count).toBe(1);
  });

  it('3 analyses → only most recent has countedInDrift=true', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test multi-analysis',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 905,
        ticketKey: `DF-905-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T00:01:00Z');
    const t2 = new Date('2026-01-01T00:02:00Z');
    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput, t0);
    await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput, t1);
    const newest = await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput, t2);

    await seedOutcome(ticket.id, ctx.projectId);
    await pairAnalysisWithOutcome(ticket.id);

    const analyses = await prisma.ticketAnalysis.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });

    const countedIds = analyses.filter((a) => a.countedInDrift).map((a) => a.id);
    expect(countedIds).toHaveLength(1);
    expect(countedIds[0]).toBe(newest.id);

    const pairing = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(pairing!.analysisId).toBe(newest.id);
  });

  // T027 — US4 audit trail
  it('US4: tie-breaker — same createdAt → highest id wins', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test tiebreaker',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 910,
        ticketKey: `DF-910-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const sameTime = new Date('2026-03-01T00:00:00Z');
    const a1 = await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput, sameTime);
    const a2 = await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput, sameTime);

    await seedOutcome(ticket.id, ctx.projectId);
    await pairAnalysisWithOutcome(ticket.id);

    const pairing = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    // Highest id wins on tie
    const expectedId = Math.max(a1.id, a2.id);
    expect(pairing!.analysisId).toBe(expectedId);
  });

  it('US4: post-ship re-analysis does not alter pairing', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test post-ship',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 911,
        ticketKey: `DF-911-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const original = await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);
    await seedOutcome(ticket.id, ctx.projectId);
    await pairAnalysisWithOutcome(ticket.id);

    // Post-ship analysis inserted
    const postShip = await seedAnalysis(ticket.id, ctx.projectId, userId, validOutput);

    // pairing row still references original
    const pairing = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(pairing!.analysisId).toBe(original.id);

    // post-ship analysis has countedInDrift=false
    const postShipRow = await prisma.ticketAnalysis.findUnique({ where: { id: postShip.id } });
    expect(postShipRow!.countedInDrift).toBe(false);

    // no second pairing created
    const count = await prisma.analysisOutcomePairing.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(1);
  });

  it('output unparseable → row with unpairedReason=output_unparseable', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] pair test bad output',
        description: 'test',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 906,
        ticketKey: `DF-906-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    await seedAnalysis(ticket.id, ctx.projectId, userId, { invalid: true });
    await seedOutcome(ticket.id, ctx.projectId);

    const result = await pairAnalysisWithOutcome(ticket.id);
    expect(result.paired).toBe(false);
    expect(result.reason).toBe('output_unparseable');

    const row = await prisma.analysisOutcomePairing.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).not.toBeNull();
    expect(row!.unpairedReason).toBe('output_unparseable');
    expect(row!.frictionIncomparable).toBe(true);
    expect(row!.costIncomparable).toBe(true);
    expect(row!.qualityIncomparable).toBe(true);
    expect(row!.recommendationIncomparable).toBe(true);
  });
});
