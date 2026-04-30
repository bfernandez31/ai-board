/**
 * Integration test for T030 (US4, FR-004 / Edge case 1).
 *
 * Tickets with no `success` analysis produce no calibration row. Adoption still
 * counts the ticket because ≥1 analysis row of any status exists.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration no-success-analysis (US4)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('writes no calibration row when only failed and running analyses exist', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'failed',
      output: null,
    });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
      status: 'running',
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

    // The ticket has analyses → still counted in adoption.
    const analyses = await prisma.ticketAnalysis.findMany({
      where: { ticketId: ticket.id },
    });
    expect(analyses.length).toBeGreaterThanOrEqual(2);
  });
});
