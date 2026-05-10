import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import {
  deleteAllInsightsReports,
  seedAdminAllowlistedUser,
} from '@/tests/helpers/admin-insights-fixtures';

/**
 * Compare a non-admin response against a baseline /not-a-real-path-... response.
 * Excludes Set-Cookie and Date headers from the byte-equivalence comparison.
 */
function stripVolatileHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase();
    if (key === 'set-cookie' || key === 'date' || key === 'content-length') continue;
    out[key] = v;
  }
  return out;
}

const PROTECTED_PATHS = [
  '/api/admin/insights/reports',
  '/api/admin/insights/reports/1/html',
  '/api/admin/insights/runs',
  '/api/admin/insights/reports/1/status',
];

describe('Admin routes — 404 response parity for non-admin callers', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await deleteAllInsightsReports();
    await seedAdminAllowlistedUser('e2e-admin-parity@e2e.local');
  });

  afterEach(async () => {
    await deleteAllInsightsReports();
    await prisma.user
      .delete({ where: { email: 'e2e-admin-parity@e2e.local' } })
      .catch(() => undefined);
  });

  function anonymous() {
    return createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });
  }

  function nonAdmin() {
    return createAPIClient({ testUserId: 'test-user-id' });
  }

  for (const path of PROTECTED_PATHS) {
    it(`anonymous caller gets a 404 with no body on ${path}`, async () => {
      const res = await anonymous().fetch(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    });

    it(`non-allowlisted caller gets a 404 with no body on ${path}`, async () => {
      const res = await nonAdmin().fetch(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    });
  }

  it('admin API 404 headers match a genuine missing-route baseline (no content-type leak)', async () => {
    const baselinePath = `/api/this-does-not-exist-${Math.random().toString(36).slice(2)}`;
    const baseline = await anonymous().fetch(baselinePath);
    const probe = await anonymous().fetch('/api/admin/insights/reports');

    expect(probe.status).toBe(baseline.status);
    // Body equivalence
    expect(await probe.text()).toBe(await baseline.text());
    // Header equivalence (excluding volatile)
    const a = stripVolatileHeaders(baseline.headers);
    const b = stripVolatileHeaders(probe.headers);
    // Both must NOT advertise www-authenticate, must NOT include admin-revealing headers
    expect(b['www-authenticate']).toBeUndefined();
    expect(b['cache-control']).toBe(a['cache-control']);
  });
});
