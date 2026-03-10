import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('POST /api/webhooks/stripe', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should reject requests without stripe-signature header', async () => {
    const response = await ctx.api.post<{ error: string }>('/api/webhooks/stripe', {
      type: 'checkout.session.completed',
    });

    // Without a valid signature, should return 400
    expect(response.status).toBe(400);
  });

  it('should reject requests with invalid signature', async () => {
    const response = await ctx.api.fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid_signature',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid signature');
  });
});
