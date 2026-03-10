import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, createAPIClient, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('POST /api/billing/checkout', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return 401 for unauthenticated request', async () => {
    const unauthApi = createAPIClient({ testUserId: '' });
    const response = await unauthApi.post<{ error: string }>('/api/billing/checkout', {
      plan: 'PRO',
    });

    expect(response.status).toBe(401);
  });

  it('should reject invalid plan', async () => {
    const response = await ctx.api.post<{ error: string }>('/api/billing/checkout', {
      plan: 'INVALID',
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('Invalid plan');
  });

  it('should reject FREE plan', async () => {
    const response = await ctx.api.post<{ error: string }>('/api/billing/checkout', {
      plan: 'FREE',
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('Invalid plan');
  });

  it('should reject missing plan', async () => {
    const response = await ctx.api.post<{ error: string }>('/api/billing/checkout', {});

    expect(response.status).toBe(400);
    expect(response.data.error).toBe('Invalid plan');
  });
});
