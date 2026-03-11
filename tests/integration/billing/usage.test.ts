import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/billing/usage', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Clean up any subscriptions
    const user = await prisma.user.findFirst({ where: { email: 'test@e2e.local' } });
    if (user) {
      await prisma.subscription.deleteMany({ where: { userId: user.id } });
    }
  });

  it('should return usage data for Free plan user', async () => {
    const response = await ctx.api.get<{
      plan: string;
      planName: string;
      projects: { current: number; max: number | null };
      ticketsThisMonth: { current: number; max: number | null; resetDate: string };
      status: string;
      gracePeriodEndsAt: string | null;
    }>('/api/billing/usage');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('FREE');
    expect(response.data.planName).toBe('Free');
    expect(response.data.projects.max).toBe(1);
    expect(response.data.ticketsThisMonth.max).toBe(5);
    expect(response.data.status).toBe('none');
    expect(response.data.gracePeriodEndsAt).toBeNull();
    expect(response.data.projects.current).toBeGreaterThanOrEqual(0);
    expect(response.data.ticketsThisMonth.current).toBeGreaterThanOrEqual(0);
    expect(response.data.ticketsThisMonth.resetDate).toBeTruthy();
  });

  it('should return unlimited values for Pro plan user', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'test@e2e.local' } });
    if (!user) throw new Error('Test user not found');

    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: `sub_usage_test_${Date.now()}`,
        stripePriceId: 'price_test_pro',
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await ctx.api.get<{
      plan: string;
      planName: string;
      projects: { current: number; max: number | null };
      ticketsThisMonth: { current: number; max: number | null; resetDate: string };
    }>('/api/billing/usage');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('PRO');
    expect(response.data.planName).toBe('Pro');
    expect(response.data.projects.max).toBeNull();
    expect(response.data.ticketsThisMonth.max).toBeNull();
  });

  it('should count projects correctly', async () => {
    const response = await ctx.api.get<{
      projects: { current: number; max: number | null };
    }>('/api/billing/usage');

    expect(response.status).toBe(200);
    // The test context creates at least one project
    expect(response.data.projects.current).toBeGreaterThanOrEqual(1);
  });

  it('should return reset date as first of next month', async () => {
    const response = await ctx.api.get<{
      ticketsThisMonth: { resetDate: string };
    }>('/api/billing/usage');

    expect(response.status).toBe(200);
    const resetDate = new Date(response.data.ticketsThisMonth.resetDate);
    expect(resetDate.getUTCDate()).toBe(1);
    expect(resetDate.getUTCHours()).toBe(0);
  });
});
