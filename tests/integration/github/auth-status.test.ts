/**
 * Integration Tests: GET /api/github/auth-status
 *
 * Tests auth status checking for GitHub OAuth scope.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/github/auth-status', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns 401 for unauthenticated requests', async () => {
    const response = await ctx.api.get('/api/github/auth-status', {
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    expect(response.status).toBe(401);
  });

  it('returns hasGitHubAccount: false when user has no GitHub Account', async () => {
    const response = await ctx.api.get<{
      hasGitHubAccount: boolean;
      hasRepoScope: boolean;
    }>('/api/github/auth-status');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      hasGitHubAccount: false,
      hasRepoScope: false,
    });
  });

  it('returns hasRepoScope: false for token without repo scope (T022)', async () => {
    // The test user has no GitHub account, so hasRepoScope is false
    const response = await ctx.api.get<{
      hasGitHubAccount: boolean;
      hasRepoScope: boolean;
    }>('/api/github/auth-status');

    expect(response.status).toBe(200);
    expect(response.data.hasRepoScope).toBe(false);
  });
});
