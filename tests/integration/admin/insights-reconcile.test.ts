import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { reconcileOrphanedInsightsReports } from '@/lib/admin/insights/reconcile';
import {
  deleteAllInsightsReports,
  seedRunningInsightsReport,
  seedCompletedInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

describe('reconcileOrphanedInsightsReports', () => {
  const prisma = getPrismaClient();

  beforeEach(async () => {
    await deleteAllInsightsReports();
    vi.useRealTimers();
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
    vi.useRealTimers();
  });

  it('flips stale RUNNING rows to FAILED with the canonical errorReason', async () => {
    // Start a RUNNING row in the past — using INSIGHTS_RUN_TIMEOUT_MS default
    // (60min). We seed it with startedAt 2 hours ago and reconcile at "now".
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const row = await seedRunningInsightsReport({ startedAt: twoHoursAgo });

    const count = await reconcileOrphanedInsightsReports();
    expect(count).toBeGreaterThanOrEqual(1);

    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe('FAILED');
    expect(after?.errorReason).toBe(
      'Run timed out — workflow did not report terminal status'
    );
    expect(after?.completedAt).not.toBeNull();
  });

  it('does not touch fresh RUNNING rows', async () => {
    const row = await seedRunningInsightsReport({
      startedAt: new Date(Date.now() - 5_000),
    });
    await reconcileOrphanedInsightsReports();
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe('RUNNING');
    expect(after?.completedAt).toBeNull();
  });

  it('is idempotent on a second invocation', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const row = await seedRunningInsightsReport({ startedAt: twoHoursAgo });
    await reconcileOrphanedInsightsReports();
    const first = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    const firstCompleted = first?.completedAt;
    const secondCount = await reconcileOrphanedInsightsReports();
    expect(secondCount).toBe(0);
    const second = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(second?.completedAt?.toISOString()).toBe(
      firstCompleted?.toISOString()
    );
  });

  it('leaves COMPLETED rows alone', async () => {
    const row = await seedCompletedInsightsReport();
    await reconcileOrphanedInsightsReports();
    const after = await prisma.adminInsightsReport.findUnique({
      where: { id: row.id },
    });
    expect(after?.status).toBe('COMPLETED');
  });
});
