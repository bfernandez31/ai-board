import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

interface UsageResponse {
  projects: { current: number; limit: number | null };
  ticketsThisMonth: { current: number; limit: number | null };
}

describe('GET /api/billing/usage', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return usage data for authenticated user', async () => {
    const response = await ctx.api.get<UsageResponse>('/api/billing/usage');
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('projects');
    expect(response.data).toHaveProperty('ticketsThisMonth');
    expect(response.data.projects).toHaveProperty('current');
    expect(response.data.projects).toHaveProperty('limit');
    expect(response.data.ticketsThisMonth).toHaveProperty('current');
    expect(response.data.ticketsThisMonth).toHaveProperty('limit');
  });

  it('should reflect correct project count', async () => {
    const response = await ctx.api.get<UsageResponse>('/api/billing/usage');
    expect(response.status).toBe(200);
    // The test user should have at least the test project
    expect(response.data.projects.current).toBeGreaterThanOrEqual(1);
  });

  it('should return Free plan limits for user without subscription', async () => {
    const response = await ctx.api.get<UsageResponse>('/api/billing/usage');
    expect(response.status).toBe(200);
    // Default (no subscription) = FREE plan limits
    expect(response.data.projects.limit).toBe(1);
    expect(response.data.ticketsThisMonth.limit).toBe(5);
  });

  it('should increment ticket count after creating a ticket', async () => {
    const beforeResponse = await ctx.api.get<UsageResponse>('/api/billing/usage');
    const ticketsBefore = beforeResponse.data.ticketsThisMonth.current;

    await ctx.createTicket({ title: '[e2e] Usage Test Ticket' });

    const afterResponse = await ctx.api.get<UsageResponse>('/api/billing/usage');
    expect(afterResponse.data.ticketsThisMonth.current).toBe(ticketsBefore + 1);
  });
});
