import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock stripe so we can inject valid events without a real secret
const constructEventMock = vi.fn();
vi.mock('@/lib/billing/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ items: { data: [] } }) },
  },
}));

const createStripeEventMock = vi.fn();
vi.mock('@/lib/db/subscriptions', () => ({
  createStripeEvent: createStripeEventMock,
  upsertSubscription: vi.fn(),
}));

const webhookOutcomeCreateMock = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    webhookOutcome: { create: webhookOutcomeCreateMock },
    user: { update: vi.fn() },
    subscription: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function makeWebhookRequest(body = '{}', signature = 'sig_valid') {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });
}

describe('POST /api/webhooks/stripe — WebhookOutcome capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes exactly one SUCCESS row after a handled event', async () => {
    const event = { id: 'evt_001', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', canceled_at: null, items: { data: [] } } } };
    constructEventMock.mockReturnValue(event);
    createStripeEventMock.mockResolvedValue({});
    webhookOutcomeCreateMock.mockResolvedValue({});

    // Patch prisma subscription for the handler
    const { prisma } = await import('@/lib/db/client');
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null); // No sub found → handler skips update but returns 200

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    expect(webhookOutcomeCreateMock).toHaveBeenCalledTimes(1);
    expect(webhookOutcomeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', eventId: 'evt_001' }) })
    );
  });

  it('writes exactly one FAILURE row with truncated errorMessage when handler throws', async () => {
    const event = { id: 'evt_002', type: 'invoice.payment_succeeded', data: { object: { id: 'inv_1', parent: null } } };
    constructEventMock.mockReturnValue(event);
    createStripeEventMock.mockResolvedValue({});
    webhookOutcomeCreateMock.mockResolvedValue({});

    const { prisma } = await import('@/lib/db/client');
    vi.mocked(prisma.subscription.findUnique).mockRejectedValue(new Error('DB explosion ' + 'x'.repeat(2000)));

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(500);
    expect(webhookOutcomeCreateMock).toHaveBeenCalledTimes(1);
    const callArg = webhookOutcomeCreateMock.mock.calls[0][0];
    expect(callArg.data.status).toBe('FAILURE');
    expect(callArg.data.errorMessage.length).toBeLessThanOrEqual(1000);
  });

  it('writes 0 WebhookOutcome rows when idempotency claim fails (duplicate redelivery)', async () => {
    const event = { id: 'evt_003', type: 'customer.subscription.deleted', data: { object: {} } };
    constructEventMock.mockReturnValue(event);
    // Simulate duplicate — createStripeEvent throws P2002
    const dupError = new Error('Unique constraint') as Error & { code: string };
    dupError.code = 'P2002';
    createStripeEventMock.mockRejectedValue(dupError);

    const res = await POST(makeWebhookRequest());
    expect(res.status).toBe(200);
    expect(webhookOutcomeCreateMock).not.toHaveBeenCalled();
  });

  it('preserves the 500 response even when recordWebhookOutcome itself throws', async () => {
    const event = { id: 'evt_004', type: 'invoice.payment_succeeded', data: { object: { id: 'inv_2', parent: null } } };
    constructEventMock.mockReturnValue(event);
    createStripeEventMock.mockResolvedValue({});

    const { prisma } = await import('@/lib/db/client');
    vi.mocked(prisma.subscription.findUnique).mockRejectedValue(new Error('DB down'));
    webhookOutcomeCreateMock.mockRejectedValue(new Error('outcome write failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeWebhookRequest());
    consoleSpy.mockRestore();

    expect(res.status).toBe(500);
  });
});
