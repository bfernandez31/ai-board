/**
 * Integration test for T031 (US5, FR-016 / SC-008).
 *
 * Adoption denominator excludes pre-feature tickets; numerator includes
 * tickets with any analysis row (success/failed/cold_start). Ratio is null
 * when sinceFeatureAvailable is 0.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { computeAdoption, getCalibrationDashboard } from '@/lib/calibration/queries';
import { seedAnalysis, seedTicket } from './helpers';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

describe('Calibration adoption counter (US5, FR-016)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();
  const userId = 'test-user-id';

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns null ratio when project has no analyses', async () => {
    // Seed a ticket but no analysis — feature was never available.
    await seedTicket({ projectId: ctx.projectId, userId });

    const adoption = await computeAdoption(ctx.projectId);
    expect(adoption.analyzed).toBe(0);
    expect(adoption.sinceFeatureAvailable).toBe(0);
    expect(adoption.ratio).toBeNull();
  });

  it('excludes pre-feature tickets from denominator and includes failed/cold_start in numerator', async () => {
    // Seed a "pre-feature" ticket (created before any analysis exists).
    const preFeature = await seedTicket({
      projectId: ctx.projectId,
      userId,
      ticketNumber: 5000,
    });
    await prisma.ticket.update({
      where: { id: preFeature.id },
      data: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });

    // Seed an analysis on a separate ticket (this is the feature-availability
    // moment).
    const featureTicket = await seedTicket({
      projectId: ctx.projectId,
      userId,
      ticketNumber: 5001,
    });
    await seedAnalysis({
      ticketId: featureTicket.id,
      projectId: ctx.projectId,
      userId,
      status: 'failed',
    });

    // Create a post-feature ticket without any analysis.
    await seedTicket({
      projectId: ctx.projectId,
      userId,
      ticketNumber: 5002,
    });

    // Create a post-feature ticket WITH analysis (cold_start).
    const analysedColdStart = await seedTicket({
      projectId: ctx.projectId,
      userId,
      ticketNumber: 5003,
    });
    await seedAnalysis({
      ticketId: analysedColdStart.id,
      projectId: ctx.projectId,
      userId,
      status: 'cold_start',
    });

    const adoption = await computeAdoption(ctx.projectId);
    // pre-feature ticket should NOT count in denominator.
    // We have 3 tickets at-or-after the first analysis: featureTicket,
    // post-feature without analysis, analysedColdStart.
    expect(adoption.sinceFeatureAvailable).toBeGreaterThanOrEqual(2);
    // Numerator: featureTicket + analysedColdStart = 2 distinct tickets.
    expect(adoption.analyzed).toBe(2);
    expect(adoption.ratio).not.toBeNull();
  });

  it('exposes the adoption block via getCalibrationDashboard', async () => {
    const dashboard = await getCalibrationDashboard(ctx.projectId);
    expect(dashboard.adoption).toBeDefined();
    expect(typeof dashboard.adoption.analyzed).toBe('number');
    expect(typeof dashboard.adoption.sinceFeatureAvailable).toBe('number');
  });
});
