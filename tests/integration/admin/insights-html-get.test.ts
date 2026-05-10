import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedAdminAllowlistedUser,
  seedCompletedInsightsReport,
  seedRunningInsightsReport,
} from '@/tests/helpers/admin-insights-fixtures';

describe('GET /api/admin/insights/reports/:id/html', () => {
  let ctx: TestContext;
  let adminId: string;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await deleteAllInsightsReports();
    const admin = await seedAdminAllowlistedUser('e2e-admin-html@e2e.local');
    adminId = admin.id;
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
    await prisma.user
      .delete({ where: { email: 'e2e-admin-html@e2e.local' } })
      .catch(() => undefined);
    vi.restoreAllMocks();
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

  it('404s for unauthenticated callers', async () => {
    const response = await anonymousClient().fetch(
      '/api/admin/insights/reports/1/html'
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('404s for non-allowlisted callers', async () => {
    const response = await nonAdminClient().fetch(
      '/api/admin/insights/reports/1/html'
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('404 baseline for non-COMPLETED reports', async () => {
    const running = await seedRunningInsightsReport({ triggeredById: adminId });
    const response = await adminClient().fetch(
      `/api/admin/insights/reports/${running.id}/html`
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('404 baseline for COMPLETED reports without an HTML blob key', async () => {
    const completed = await seedCompletedInsightsReport({
      triggeredById: adminId,
      htmlBlobKey: undefined,
      htmlBlobSize: undefined,
    });
    const response = await adminClient().fetch(
      `/api/admin/insights/reports/${completed.id}/html`
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('404 baseline for unknown id', async () => {
    const response = await adminClient().fetch(
      '/api/admin/insights/reports/999999/html'
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });
});
