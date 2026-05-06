/**
 * Integration test for T027 (US3, FR-003 / SC-012).
 *
 * When a ticket has multiple `success` analyses, pairing references the most
 * recent one. Older `TicketAnalysis` rows remain unmodified and are not
 * referenced by any calibration row.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { DEFAULT_ANALYSIS_OUTPUT, seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration multi-analysis (US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('pairs the latest success analysis when multiple exist', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    const earlier = await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      output: { ...DEFAULT_ANALYSIS_OUTPUT, frictionRisk: 'high' },
      createdAt: new Date(Date.now() - 3 * 60_000),
    });
    const later = await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      output: { ...DEFAULT_ANALYSIS_OUTPUT, frictionRisk: 'low' },
      createdAt: new Date(Date.now() - 1 * 60_000),
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(result.status).toBe('created');

    const row = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row?.analysisId).toBe(later.id);
    expect(row?.frictionPredictedRating).toBe('low');

    // Older analysis unchanged
    const earlierAfter = await prisma.ticketAnalysis.findUnique({
      where: { id: earlier.id },
    });
    expect(earlierAfter?.status).toBe('success');
    expect(earlierAfter?.output).toEqual({
      ...DEFAULT_ANALYSIS_OUTPUT,
      frictionRisk: 'high',
    });
  });

  it('pairs a prior success analysis when the latest analysis is failed', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    const successOlder = await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'success',
      output: DEFAULT_ANALYSIS_OUTPUT,
      createdAt: new Date(Date.now() - 5 * 60_000),
    });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'failed',
      output: null,
      createdAt: new Date(Date.now() - 1 * 60_000),
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(result.status).toBe('created');

    const row = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row?.analysisId).toBe(successOlder.id);
  });
});
