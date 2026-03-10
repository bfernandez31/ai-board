import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/billing/plans', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
  });

  it('should return all three plans', async () => {
    const response = await ctx.api.get<{ plans: Array<{ plan: string; name: string; priceMonthly: number; features: string[]; limits: Record<string, unknown> }> }>('/api/billing/plans');

    expect(response.status).toBe(200);
    expect(response.data.plans).toHaveLength(3);

    const planNames = response.data.plans.map((p) => p.plan);
    expect(planNames).toEqual(['FREE', 'PRO', 'TEAM']);
  });

  it('should include features and limits for each plan', async () => {
    const response = await ctx.api.get<{ plans: Array<{ plan: string; features: string[]; limits: { maxProjects: number | null; maxTicketsPerMonth: number | null; membersEnabled: boolean; advancedAnalytics: boolean } }> }>('/api/billing/plans');

    const freePlan = response.data.plans.find((p) => p.plan === 'FREE');
    expect(freePlan).toBeDefined();
    expect(freePlan!.features.length).toBeGreaterThan(0);
    expect(freePlan!.limits.maxProjects).toBe(1);
    expect(freePlan!.limits.maxTicketsPerMonth).toBe(5);
    expect(freePlan!.limits.membersEnabled).toBe(false);

    const teamPlan = response.data.plans.find((p) => p.plan === 'TEAM');
    expect(teamPlan).toBeDefined();
    expect(teamPlan!.limits.membersEnabled).toBe(true);
    expect(teamPlan!.limits.advancedAnalytics).toBe(true);
  });
});
