import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedAdminAllowlistedUser,
  seedRunningInsightsReport,
  seedCompletedInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

describe('POST /api/admin/insights/runs', () => {
  let ctx: TestContext;
  let adminId: string;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await deleteAllInsightsReports();
    const admin = await seedAdminAllowlistedUser('e2e-admin-trigger@e2e.local');
    adminId = admin.id;
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
    await prisma.user
      .delete({ where: { email: 'e2e-admin-trigger@e2e.local' } })
      .catch(() => undefined);
  });

  function adminClient() {
    return createAPIClient({ testUserId: adminId });
  }

  function nonAdminClient() {
    return createAPIClient({ testUserId: 'test-user-id' });
  }

  it('404 baseline for non-admin caller', async () => {
    const r = await nonAdminClient().fetch('/api/admin/insights/runs', {
      method: 'POST',
      body: '{}',
    });
    expect(r.status).toBe(404);
    expect(await r.text()).toBe('');
  });

  it('409 ALREADY_RUNNING when a RUNNING row exists', async () => {
    const running = await seedRunningInsightsReport();
    const r = await adminClient().post<{ code: string; runStartedAt: string }>(
      '/api/admin/insights/runs',
      {}
    );
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('ALREADY_RUNNING');
    expect(r.data.runStartedAt).toBe(running.startedAt.toISOString());
  });

  it('409 NO_NEW_SHIPPED_TICKETS cold-system case with previousRunAt=null', async () => {
    const r = await adminClient().post<{
      code: string;
      previousRunAt: string | null;
    }>('/api/admin/insights/runs', {});
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('NO_NEW_SHIPPED_TICKETS');
    expect(r.data.previousRunAt).toBeNull();
  });

  it('409 NO_NEW_SHIPPED_TICKETS with previousRunAt set when prior COMPLETED exists', async () => {
    const previous = await seedCompletedInsightsReport({
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-01T00:00:00.000Z'),
    });
    const r = await adminClient().post<{
      code: string;
      previousRunAt: string | null;
    }>('/api/admin/insights/runs', {});
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('NO_NEW_SHIPPED_TICKETS');
    expect(r.data.previousRunAt).toBe(previous.periodEnd.toISOString());
  });
});
