import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/settings/profile', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return profile data for authenticated user', async () => {
    const response = await ctx.api.get<{
      name: string | null;
      email: string;
      image: string | null;
      createdAt: string;
      githubUsername: string | null;
      githubUrl: string | null;
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    expect(response.data.email).toBeDefined();
    expect(response.data.createdAt).toBeDefined();
    expect(response.data.plan).toBeDefined();
    expect(['FREE', 'PRO', 'TEAM']).toContain(response.data.plan);
  });

  it('should default to FREE plan when no subscription exists', async () => {
    const response = await ctx.api.get<{
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('FREE');
  });

  it('should return correct plan for subscribed user', async () => {
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
          stripeSubscriptionId: 'sub_profile_test_123',
          stripePriceId: 'price_test_pro',
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          plan: 'PRO',
          status: 'ACTIVE',
        },
      });
    }

    const response = await ctx.api.get<{
      plan: string;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    expect(response.data.plan).toBe('PRO');

    // Cleanup
    if (user) {
      await prisma.subscription.deleteMany({
        where: { userId: user.id },
      });
    }
  });

  it('should handle GitHub API failure gracefully', async () => {
    const response = await ctx.api.get<{
      githubUsername: string | null;
      githubUrl: string | null;
    }>('/api/settings/profile');

    expect(response.status).toBe(200);
    // GitHub fields may be null if token is invalid/expired in test env
    // The important thing is the endpoint doesn't 500
    expect(response.data).toHaveProperty('githubUsername');
    expect(response.data).toHaveProperty('githubUrl');
  });

  it('should return 401 for unauthenticated request', async () => {
    const response = await fetch(
      `${process.env.TEST_BASE_URL || 'http://localhost:3000'}/api/settings/profile`
    );

    expect(response.status).toBe(401);
  });
});
