/**
 * Integration test for T029 (US4 partial outcome — FR-011 / SC-011).
 *
 * Partial outcomes with missing telemetry produce a calibration row with `n_a`
 * verdicts where the data is missing and populated verdicts where telemetry
 * survives. Friction cell is always computable.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { DEFAULT_ANALYSIS_OUTPUT, seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration partial outcome (US4, FR-011)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('writes a row with qualityVerdict=n_a + populated cost verdict + friction cell when partial=true', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      output: DEFAULT_ANALYSIS_OUTPUT,
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      qualityScore: null,
      totalCostUsd: 12.5,
      frictionFree: false,
      partial: true,
      partialReason: 'diff_truncated',
      workflowType: WorkflowType.QUICK,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(result.status).toBe('created');

    const row = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).not.toBeNull();
    if (!row) return;

    expect(row.partial).toBe(true);
    expect(row.partialReason).toBe('diff_truncated');
    expect(row.qualityVerdict).toBe('n_a');
    expect(row.qualityActual).toBeNull();
    // costPredictedSummed = baseline(1..2) + marginal(0.5..1.5) = 1.5..3.5;
    // 12.5 is outside that range → miss
    expect(row.costVerdict).toBe('miss');
    expect(row.costActualUsd).toBe(12.5);
    // friction predicted=low (clean), actual frictionFree=false → FP
    expect(row.frictionCell).toBe('FP');
    expect(['TN', 'FN']).not.toContain(row.frictionCell);
  });
});
