/**
 * Integration test for T013 (US1, FR-015).
 *
 * Asserts the 30-row dashboard window: when ≥30 calibration rows exist, only 30
 * are returned and `warmingUp=false`. When < 30, all rows are returned with
 * `warmingUp=true`.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { getCalibrationDashboard } from '@/lib/calibration/queries';
import { pairCalibrationOnOutcome } from '@/lib/calibration/pair';
import { seedAnalysis, seedOutcome, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

async function pairOne(projectId: number, userId: string, n: number): Promise<void> {
  const ticket = await seedTicket({
    projectId,
    userId,
    workflowType: WorkflowType.QUICK,
    ticketNumber: 100_000 + n,
  });
  await seedAnalysis({
    ticketId: ticket.id,
    projectId,
    userId,
  });
  await seedOutcome({
    ticketId: ticket.id,
    projectId,
    workflowType: WorkflowType.QUICK,
    shippedAt: new Date(Date.now() - n * 1000),
  });
  await pairCalibrationOnOutcome({ ticketId: ticket.id, projectId });
}

describe('Calibration dashboard window (US1, FR-015)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns windowSize=30, warmingUp=false when totalRows >= 30', async () => {
    for (let i = 0; i < 35; i += 1) {
      await pairOne(ctx.projectId, userId, i);
    }

    const dashboard = await getCalibrationDashboard(ctx.projectId);
    expect(dashboard.windowSize).toBe(30);
    expect(dashboard.totalRows).toBe(35);
    expect(dashboard.warmingUp).toBe(false);
  });

  it('returns warmingUp=true when totalRows < 30', async () => {
    for (let i = 0; i < 5; i += 1) {
      await pairOne(ctx.projectId, userId, i);
    }

    const dashboard = await getCalibrationDashboard(ctx.projectId);
    expect(dashboard.windowSize).toBe(5);
    expect(dashboard.totalRows).toBe(5);
    expect(dashboard.warmingUp).toBe(true);
  });

  it('returns warmingUp=true and zero counts when project has no calibration rows', async () => {
    const dashboard = await getCalibrationDashboard(ctx.projectId);
    expect(dashboard.windowSize).toBe(0);
    expect(dashboard.totalRows).toBe(0);
    expect(dashboard.warmingUp).toBe(true);
    expect(dashboard.confusionMatrix.total).toBe(0);
    expect(dashboard.qualityDistribution.total).toBe(0);
    expect(dashboard.costDistribution.total).toBe(0);
    expect(dashboard.recommendation.matchedRate).toBeNull();
    expect(dashboard.adoption.analyzed).toBe(0);
  });

  // Sanity: Prisma client reachable (avoids dead-import warnings in linters)
  it('Prisma client is wired', () => {
    expect(typeof prisma.analysisCalibration.count).toBe('function');
  });
});
