/**
 * Integration Tests: Profile Settings API
 *
 * AIB-467: Tests for GET /api/settings/profile endpoint.
 * Verifies profile data retrieval, fallback behavior, and auth guard.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/settings/profile', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();

    // Billing tests (feature-gating, usage, subscription) delete the PRO subscription
    // as part of their test setup. Re-provision it here so profile tests are not
    // affected by test execution order.
    const prisma = getPrismaClient();
    const user = await prisma.user.findFirst({ where: { email: 'test@e2e.local' } });
    if (user) {
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { plan: 'PRO', status: 'ACTIVE' },
        create: {
          userId: user.id,
          stripeSubscriptionId: `sub_test_fixtures_${user.id}`,
          stripePriceId: 'price_test_pro',
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }
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

  it('should return plan from subscription when subscription exists', async () => {
    const response = await ctx.api.get<{
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    // Test user has a PRO subscription provisioned by ensureTestFixtures (db-cleanup.ts)
    expect(response.data.plan).toBe('PRO');
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
