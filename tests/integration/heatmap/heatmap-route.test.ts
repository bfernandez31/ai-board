import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/heatmap', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await ctx.api.get('/api/heatmap', {
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    expect(response.status).toBe(401);
    expect(response.data).toHaveProperty('error', 'Unauthorized');
  });

  it('returns valid heatmap data structure with correct field types', async () => {
    const response = await ctx.api.get<{
      days: unknown[];
      totalJobs: number;
      totalShipped: number;
      agents: unknown[];
      periodLabel: string;
      userCreatedYear: number;
    }>('/api/heatmap');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('days');
    expect(Array.isArray(response.data.days)).toBe(true);
    expect(typeof response.data.totalJobs).toBe('number');
    expect(typeof response.data.totalShipped).toBe('number');
    expect(Array.isArray(response.data.agents)).toBe(true);
    expect(typeof response.data.periodLabel).toBe('string');
    expect(typeof response.data.userCreatedYear).toBe('number');
  });

  it('returns "in the last year" for rolling period', async () => {
    const response = await ctx.api.get<{ periodLabel: string }>('/api/heatmap?year=rolling');

    expect(response.status).toBe(200);
    expect(response.data.periodLabel).toBe('in the last year');
  });

  it('returns "in YYYY" for calendar year period', async () => {
    const response = await ctx.api.get<{ periodLabel: string }>('/api/heatmap?year=2025');

    expect(response.status).toBe(200);
    expect(response.data.periodLabel).toBe('in 2025');
  });

  it('returns 400 for invalid year parameter', async () => {
    const response = await ctx.api.get('/api/heatmap?year=abc');

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error', 'Invalid year parameter');
  });

  it('returns 400 for invalid agent parameter', async () => {
    const response = await ctx.api.get('/api/heatmap?agent=INVALID_AGENT');

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error', 'Invalid agent parameter');
  });

  it('returns correct userCreatedYear', async () => {
    const response = await ctx.api.get<{ userCreatedYear: number }>('/api/heatmap');

    expect(response.status).toBe(200);
    expect(typeof response.data.userCreatedYear).toBe('number');
    expect(response.data.userCreatedYear).toBeGreaterThanOrEqual(2020);
    expect(response.data.userCreatedYear).toBeLessThanOrEqual(new Date().getFullYear());
  });

  it('agents array always includes "all" option first', async () => {
    const response = await ctx.api.get<{
      agents: { value: string; label: string; isDefault: boolean }[];
    }>('/api/heatmap');

    expect(response.status).toBe(200);
    expect(response.data.agents.length).toBeGreaterThanOrEqual(1);
    expect(response.data.agents[0]).toEqual(
      expect.objectContaining({
        value: 'all',
        label: 'All agents',
        isDefault: true,
      })
    );
  });

  it('defaults to rolling period with all agents', async () => {
    const response = await ctx.api.get<{
      periodLabel: string;
    }>('/api/heatmap');

    expect(response.status).toBe(200);
    expect(response.data.periodLabel).toBe('in the last year');
  });

  it('day entries have correct shape when present', async () => {
    const response = await ctx.api.get<{
      days: {
        date: string;
        jobCount: number;
        costUsd: number | null;
        shippedTickets: { ticketKey: string; title: string }[];
      }[];
    }>('/api/heatmap');

    expect(response.status).toBe(200);
    for (const day of response.data.days) {
      expect(day).toHaveProperty('date');
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof day.jobCount).toBe('number');
      expect(day.costUsd === null || typeof day.costUsd === 'number').toBe(true);
      expect(Array.isArray(day.shippedTickets)).toBe(true);
    }
  });
});
