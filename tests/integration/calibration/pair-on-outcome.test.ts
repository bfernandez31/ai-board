/**
 * Integration test for T008 (US2 happy path).
 *
 * Seed an `[e2e]` ticket + `success` analysis with valid output + outcome row.
 * Drive `pairCalibrationOnOutcome`. Assert exactly one calibration row with all
 * paired fields populated. Assert FK references point at the seeded analysis
 * and outcome rows.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { CALIBRATION_RULE_SET_VERSION } from '@/lib/calibration/types';
import {
  DEFAULT_ANALYSIS_OUTPUT,
  seedAnalysis,
  seedOutcome,
  seedTicket,
} from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration pairing — happy path (US2)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('produces exactly one calibration row with paired fields and FKs', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    const analysis = await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'success',
      output: DEFAULT_ANALYSIS_OUTPUT,
    });
    const outcome = await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      qualityScore: 80,
      totalCostUsd: 2.5,
      frictionFree: true,
      workflowType: WorkflowType.QUICK,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });

    expect(result.status).toBe('created');

    const rows = await prisma.analysisCalibration.findMany({
      where: { ticketId: ticket.id },
    });
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.analysisId).toBe(analysis.id);
    expect(row.outcomeId).toBe(outcome.id);
    expect(row.projectId).toBe(ctx.projectId);
    expect(row.ruleSetVersion).toBe(CALIBRATION_RULE_SET_VERSION);

    expect(row.frictionPredictedRating).toBe('low');
    expect(row.frictionPredictedClean).toBe(true);
    expect(row.frictionActualFree).toBe(true);
    expect(row.frictionCell).toBe('TP');

    expect(row.qualityPredictedLower).toBe(70);
    expect(row.qualityPredictedUpper).toBe(90);
    expect(row.qualityActual).toBe(80);
    expect(row.qualityVerdict).toBe('hit');

    expect(row.costPredictedSummedLowerUsd).toBeCloseTo(1.5, 9);
    expect(row.costPredictedSummedUpperUsd).toBeCloseTo(3.5, 9);
    expect(row.costActualUsd).toBe(2.5);
    expect(row.costVerdict).toBe('hit');

    expect(row.recommendationPredicted).toBe('QUICK');
    expect(row.workflowActual).toBe(WorkflowType.QUICK);
    expect(row.recommendationMatched).toBe(true);
    expect(row.recommendationFrictionAligned).toBe(true);

    expect(row.partial).toBe(false);
    expect(row.partialReason).toBeNull();
  });

  it('handles inclusive upper-bound edge case for quality (hit at upper bound)', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      output: { ...DEFAULT_ANALYSIS_OUTPUT, qualityGateRange: { lower: 60, upper: 90 } },
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      qualityScore: 90,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(result.status).toBe('created');

    const row = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row?.qualityVerdict).toBe('hit');
  });
});
