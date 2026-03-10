import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('POST /api/billing/portal', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return 400 when user has no stripe customer ID', async () => {
    const response = await ctx.api.post<{ error: string }>('/api/billing/portal', {});

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('No billing account found');
  });
});
