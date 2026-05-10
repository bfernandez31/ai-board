import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedAdminAllowlistedUser,
  seedCompletedInsightsReport,
  seedFailedInsightsReport,
  seedRunningInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

describe('GET /api/admin/insights/reports', () => {
  let ctx: TestContext;
  let adminEmail: string;
  let adminId: string;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await deleteAllInsightsReports();
    const admin = await seedAdminAllowlistedUser('e2e-admin-list@e2e.local');
    adminEmail = admin.email;
    adminId = admin.id;
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
    await prisma.user
      .delete({ where: { email: 'e2e-admin-list@e2e.local' } })
      .catch(() => undefined);
  });

  function adminClient() {
    return createAPIClient({ testUserId: adminId });
  }

  function nonAdminClient() {
    return createAPIClient({ testUserId: 'test-user-id' });
  }

  function anonymousClient() {
    return createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });
  }

  it('404s for unauthenticated callers with no body', async () => {
    const response = await anonymousClient().fetch('/api/admin/insights/reports');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('404s for non-allowlisted callers with no body', async () => {
    const response = await nonAdminClient().fetch('/api/admin/insights/reports');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('200 with reports and runningReportId for allowlisted caller', async () => {
    const completed = await seedCompletedInsightsReport({
      triggeredById: adminId,
      sessionsCount: 12,
      ticketsCount: 4,
    });
    const failed = await seedFailedInsightsReport({
      triggeredById: adminId,
      errorReason: 'Insights analyzer exited non-zero',
    });
    const running = await seedRunningInsightsReport({ triggeredById: adminId });

    const response = await adminClient().get<{
      reports: Array<{
        id: number;
        status: string;
        triggeredByEmail: string | null;
        errorReason: string | null;
      }>;
      runningReportId: number | null;
    }>('/api/admin/insights/reports');

    expect(response.status).toBe(200);
    expect(response.response.headers.get('cache-control')).toContain('no-store');
    expect(response.data.runningReportId).toBe(running.id);
    expect(response.data.reports.length).toBe(3);
    expect(response.data.reports.map((r) => r.id)).toEqual([
      running.id,
      failed.id,
      completed.id,
    ]);
    expect(response.data.reports[0]!.triggeredByEmail).toBe(adminEmail);
    expect(
      response.data.reports.find((r) => r.id === failed.id)!.errorReason
    ).toBe('Insights analyzer exited non-zero');
    // htmlBlobKey/Size never leaked
    for (const r of response.data.reports as unknown as Record<string, unknown>[]) {
      expect(r.htmlBlobKey).toBeUndefined();
      expect(r.htmlBlobSize).toBeUndefined();
    }
  });

  it('respects the limit query param up to 200', async () => {
    for (let i = 0; i < 5; i++) {
      await seedCompletedInsightsReport({ triggeredById: adminId });
    }
    const response = await adminClient().get<{
      reports: Array<{ id: number }>;
    }>('/api/admin/insights/reports?limit=2');
    expect(response.status).toBe(200);
    expect(response.data.reports.length).toBe(2);
  });

  it('caps limit at 200 even when client requests more', async () => {
    const response = await adminClient().get<{
      reports: Array<{ id: number }>;
    }>('/api/admin/insights/reports?limit=1000');
    expect(response.status).toBe(200);
    expect(response.data.reports.length).toBeLessThanOrEqual(200);
  });

  it('US4 — orders by createdAt desc with mixed statuses and runningReportId resolves', async () => {
    const olderCompleted = await seedCompletedInsightsReport({
      triggeredById: adminId,
      sessionsCount: 1,
      ticketsCount: 1,
    });
    // Insert a small delay so that createdAt differs measurably.
    await new Promise((r) => setTimeout(r, 20));
    const failed = await seedFailedInsightsReport({
      triggeredById: adminId,
      errorReason: 'old failure',
    });
    await new Promise((r) => setTimeout(r, 20));
    const newerCompleted = await seedCompletedInsightsReport({
      triggeredById: adminId,
      sessionsCount: 2,
      ticketsCount: 2,
    });
    await new Promise((r) => setTimeout(r, 20));
    const running = await seedRunningInsightsReport({ triggeredById: adminId });

    const response = await adminClient().get<{
      reports: Array<{ id: number; status: string; errorReason: string | null }>;
      runningReportId: number | null;
    }>('/api/admin/insights/reports');
    expect(response.status).toBe(200);
    expect(response.data.runningReportId).toBe(running.id);
    expect(response.data.reports.map((r) => r.id)).toEqual([
      running.id,
      newerCompleted.id,
      failed.id,
      olderCompleted.id,
    ]);
    const failedRow = response.data.reports.find((r) => r.id === failed.id)!;
    expect(failedRow.status).toBe('FAILED');
    expect(failedRow.errorReason).toBe('old failure');
  });
});
