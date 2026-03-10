/**
 * Unit Test: Stripe Webhook Route
 *
 * Tests the webhook signature verification and event handling logic.
 * Uses mocks since we can't hit real Stripe in unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Stripe before imports
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    subscription: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe/plans', () => ({
  getPlanFromPriceId: vi.fn().mockReturnValue('PRO'),
}));

describe('Stripe Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set webhook secret for tests
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('should reject requests without stripe-signature header', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');

    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      body: '{}',
      headers: {},
    });

    // NextRequest constructor from next/server
    const { NextRequest } = await import('next/server');
    const nextRequest = new NextRequest(request);

    const response = await POST(nextRequest);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Missing stripe-signature header');
  });

  it('should reject requests with invalid signature', async () => {
    const { stripe } = await import('@/lib/stripe/client');
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const { POST } = await import('@/app/api/stripe/webhook/route');

    const { NextRequest } = await import('next/server');
    const request = new NextRequest(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'invalid_sig' },
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Invalid signature');
  });

  it('should return 200 for valid unhandled event types', async () => {
    const { stripe } = await import('@/lib/stripe/client');
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      type: 'some.unhandled.event',
      data: { object: {} },
    });

    const { POST } = await import('@/app/api/stripe/webhook/route');

    const { NextRequest } = await import('next/server');
    const request = new NextRequest(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'valid_sig' },
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(true);
  });

  it('should upsert subscription on customer.subscription.created', async () => {
    const { stripe } = await import('@/lib/stripe/client');
    const { prisma } = await import('@/lib/db/client');

    const mockSubscription = {
      id: 'sub_test123',
      status: 'active',
      metadata: { userId: 'user-1' },
      items: { data: [{ price: { id: 'price_pro' } }] },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      cancel_at_period_end: false,
      trial_start: null,
      trial_end: null,
    };

    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      type: 'customer.subscription.created',
      data: { object: mockSubscription },
    });

    const { POST } = await import('@/app/api/stripe/webhook/route');

    const { NextRequest } = await import('next/server');
    const request = new NextRequest(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'valid_sig' },
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_test123' },
        create: expect.objectContaining({
          userId: 'user-1',
          stripeSubscriptionId: 'sub_test123',
          plan: 'PRO',
          status: 'ACTIVE',
        }),
        update: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      })
    );
  });

  it('should mark subscription as CANCELED on customer.subscription.deleted', async () => {
    const { stripe } = await import('@/lib/stripe/client');
    const { prisma } = await import('@/lib/db/client');

    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_deleted',
          metadata: { userId: 'user-1' },
        },
      },
    });

    const { POST } = await import('@/app/api/stripe/webhook/route');

    const { NextRequest } = await import('next/server');
    const request = new NextRequest(
      new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'valid_sig' },
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_deleted' },
      data: { status: 'CANCELED' },
    });
  });
});
