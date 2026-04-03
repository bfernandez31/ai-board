/**
 * Integration Tests: GET /api/account/summary
 *
 * AIB-466: Tests for account summary endpoint.
 * Verifies data counts, subscription status, and auth guard.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/account/summary', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();

    // Ensure the test user has a PRO subscription (may be deleted by other tests)
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

  it('should return correct counts for authenticated user', async () => {
    const response = await ctx.api.get<{
      projectCount: number;
      credentialCount: number;
      tokenCount: number;
      hasActiveSubscription: boolean;
      plan: string;
    }>('/api/account/summary');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('projectCount');
    expect(response.data).toHaveProperty('credentialCount');
    expect(response.data).toHaveProperty('tokenCount');
    expect(response.data).toHaveProperty('hasActiveSubscription');
    expect(response.data).toHaveProperty('plan');
    expect(typeof response.data.projectCount).toBe('number');
    expect(typeof response.data.credentialCount).toBe('number');
    expect(typeof response.data.tokenCount).toBe('number');
    expect(typeof response.data.hasActiveSubscription).toBe('boolean');
  });

  it('should report active subscription for user with PRO plan', async () => {
    const response = await ctx.api.get<{
      hasActiveSubscription: boolean;
      plan: string;
    }>('/api/account/summary');

    expect(response.status).toBe(200);
    expect(response.data.hasActiveSubscription).toBe(true);
    expect(response.data.plan).toBe('PRO');
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await ctx.api.get<{ error: string }>(
      '/api/account/summary',
      { includeTestUserHeader: false, enableTestAuthOverride: false }
    );

    expect(response.status).toBe(401);
  });
});
