/**
 * Integration Tests: Profile Settings API
 *
 * AIB-467: Tests for GET /api/settings/profile endpoint.
 * Verifies profile data retrieval, fallback behavior, and auth guard.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/settings/profile', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
  });

  it('should return profile data for authenticated user', async () => {
    const response = await ctx.api.get<{
      name: string;
      email: string;
      image: string | null;
      githubUsername: string | null;
      githubProfileUrl: string | null;
      createdAt: string;
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('name');
    expect(response.data).toHaveProperty('email');
    expect(response.data).toHaveProperty('image');
    expect(response.data).toHaveProperty('githubUsername');
    expect(response.data).toHaveProperty('githubProfileUrl');
    expect(response.data).toHaveProperty('createdAt');
    expect(response.data).toHaveProperty('plan');
  });

  it('should return FREE plan when no subscription exists', async () => {
    const response = await ctx.api.get<{
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    // Test user typically has no subscription, defaults to FREE
    expect(response.data.plan).toBe('FREE');
  });

  it('should return valid ISO date for createdAt', async () => {
    const response = await ctx.api.get<{
      createdAt: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    const date = new Date(response.data.createdAt);
    expect(date.toISOString()).toBe(response.data.createdAt);
  });

  it('should return a non-empty name (fallback chain)', async () => {
    const response = await ctx.api.get<{
      name: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    expect(response.data.name).toBeTruthy();
    expect(response.data.name.length).toBeGreaterThan(0);
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await ctx.api.get<{ error: string }>(
      '/api/settings/profile',
      { includeTestUserHeader: false, enableTestAuthOverride: false }
    );

    expect(response.status).toBe(401);
    expect(response.data.error).toBe('Unauthorized');
  });
});
