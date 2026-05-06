/**
 * Integration test for T009 (US2 immutability — FR-005, SC-002).
 *
 * Re-running pairing for the same ticket must be a no-op: returns 'duplicate'
 * and the existing row is byte-identical.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration immutability (US2)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('second pair attempt returns duplicate and leaves row byte-identical', async () => {
    const ticket = await seedTicket({ projectId: ctx.projectId, userId });
    await seedAnalysis({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      userId,
    });
    await seedOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });

    const first = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(first.status).toBe('created');

    const rowBefore = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(rowBefore).not.toBeNull();

    const second = await pairCalibrationOnOutcome({
      ticketId: ticket.id,
      projectId: ctx.projectId,
    });
    expect(second.status).toBe('duplicate');

    const rowAfter = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(rowAfter).toEqual(rowBefore);

    const allRows = await prisma.analysisCalibration.findMany({
      where: { ticketId: ticket.id },
    });
    expect(allRows).toHaveLength(1);
  });
});
