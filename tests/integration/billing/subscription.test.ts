import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/billing/subscription', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return FREE plan for user without subscription', async () => {
    const response = await ctx.api.get<{
      plan: string;
      status: string;
      limits: { maxProjects: number; maxTicketsPerMonth: number; membersEnabled: boolean; advancedAnalytics: boolean };
    }>('/api/billing/subscription');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('FREE');
    expect(response.data.status).toBe('none');
    expect(response.data.limits.maxProjects).toBe(1);
    expect(response.data.limits.maxTicketsPerMonth).toBe(5);
    expect(response.data.limits.membersEnabled).toBe(false);
  });

  it('should return subscription data for subscribed user', async () => {
    const { getPrismaClient } = await import('@/tests/helpers/db-cleanup');
    const prisma = getPrismaClient();

    const user = await prisma.user.findFirst({
      where: { email: 'test@e2e.local' },
    });

    if (user) {
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeSubscriptionId: 'sub_test_123',
          stripePriceId: 'price_test_pro',
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          plan: 'PRO',
          status: 'ACTIVE',
          stripePriceId: 'price_test_pro',
          stripeSubscriptionId: 'sub_test_123',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const response = await ctx.api.get<{
      plan: string;
      status: string;
      limits: { maxProjects: number | null; maxTicketsPerMonth: number | null };
    }>('/api/billing/subscription');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('PRO');
    expect(response.data.status).toBe('active');
    expect(response.data.limits.maxProjects).toBeNull();
    expect(response.data.limits.maxTicketsPerMonth).toBeNull();

    // Cleanup
    if (user) {
      await prisma.subscription.deleteMany({ where: { userId: user.id } });
    }
  });
});
