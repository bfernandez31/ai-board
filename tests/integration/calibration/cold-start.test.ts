/**
 * Integration test for T028 (US4 cold-start).
 *
 * Cold-start latest-analysis tickets produce no calibration row but still
 * count in adoption (analysis row exists for the ticket).
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration cold-start (US4)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('writes no calibration row when latest analysis is cold_start', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'cold_start',
      output: null,
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });

    const result = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(result.status).toBe('no_success_analysis');

    const row = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(row).toBeNull();

    // Ticket still has an analysis row (any status), so it counts in adoption.
    const analyses = await prisma.ticketAnalysis.findMany({
      where: { ticketId: ticket.id },
    });
    expect(analyses).toHaveLength(1);
    expect(analyses[0].status).toBe('cold_start');
  });
});
