/**
 * Integration Tests: GET /api/github/repos
 *
 * Tests the repo listing endpoint auth and scope requirements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/github/repos', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns 401 for unauthenticated requests', async () => {
    const response = await ctx.api.get('/api/github/repos', {
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 MISSING_SCOPE when token lacks repo scope (T023)', async () => {
    // Test user has no GitHub account with repo scope
    const response = await ctx.api.get<{
      error: string;
      code: string;
    }>('/api/github/repos');

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('MISSING_SCOPE');
  });

  it('returns 403 MISSING_SCOPE when searching with q param (T028)', async () => {
    const response = await ctx.api.get<{
      error: string;
      code: string;
    }>('/api/github/repos?q=test');

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('MISSING_SCOPE');
  });

  it('returns 403 MISSING_SCOPE when filtering by org (T029)', async () => {
    const response = await ctx.api.get<{
      error: string;
      code: string;
    }>('/api/github/repos?org=my-org');

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('MISSING_SCOPE');
  });
});
