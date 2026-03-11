import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Member count limit enforcement', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should block member addition when membersEnabled is false (Free plan)', async () => {
    // Free plan has membersEnabled: false
    const user = await ctx.createUser(`e2e-member-test-${Date.now()}@e2e.test`);

    const response = await ctx.api.post<{ error: string; code?: string }>(
      `/api/projects/${ctx.projectId}/members`,
      { email: user.email }
    );

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('PLAN_LIMIT');
  });

  it('should enforce per-project member count limit for Team plan', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'test@e2e.local' } });
    if (!user) throw new Error('Test user not found');

    // Set up Team plan subscription
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: `sub_member_limit_${Date.now()}`,
        stripePriceId: 'price_test_team',
        plan: 'TEAM',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Add 9 members (owner already counts as 1 member, limit is 10 total)
    const memberEmails: string[] = [];
    for (let i = 0; i < 9; i++) {
      const memberUser = await ctx.createUser(`e2e-member-${i}-${Date.now()}@e2e.test`);
      memberEmails.push(memberUser.email);

      const addResponse = await ctx.api.post<{ id: string; error?: string; code?: string }>(
        `/api/projects/${ctx.projectId}/members`,
        { email: memberUser.email }
      );
      expect(addResponse.status).toBe(201);
    }

    // 10th external member should be blocked (owner + 9 = 10, limit reached)
    const extraUser = await ctx.createUser(`e2e-member-extra-${Date.now()}@e2e.test`);
    const response = await ctx.api.post<{ error: string; code?: string }>(
      `/api/projects/${ctx.projectId}/members`,
      { email: extraUser.email }
    );

    expect(response.status).toBe(403);
    expect(response.data.code).toBe('PLAN_LIMIT');
    expect(response.data.error).toContain('Member limit reached');

    // Clean up subscription
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
  });
});
