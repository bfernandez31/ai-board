/**
 * Unit Tests: deleteUserAccount()
 *
 * AIB-466: Verifies account deletion logic including Stripe subscription
 * cancellation, GDPR-compliant error handling, and cascade deletion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all transitive dependencies before importing the subject
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
}));

vi.mock('@/lib/tokens/validate', () => ({
  extractBearerToken: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/billing/stripe', () => ({
  stripe: {
    subscriptions: {
      cancel: vi.fn(),
    },
  },
}));

import { deleteUserAccount, StripeCleanupError } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { stripe } from '@/lib/billing/stripe';

describe('deleteUserAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel Stripe subscription and delete user when subscription exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: 'cus_123',
      subscription: { stripeSubscriptionId: 'sub_123', status: 'ACTIVE' },
    } as never);
    vi.mocked(stripe.subscriptions.cancel).mockResolvedValue({} as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    await deleteUserAccount('user-1');

    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('should delete user then throw StripeCleanupError with cause when Stripe cancellation fails (GDPR compliance)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: 'cus_123',
      subscription: { stripeSubscriptionId: 'sub_123', status: 'ACTIVE' },
    } as never);
    const stripeError = new Error('Stripe API error');
    vi.mocked(stripe.subscriptions.cancel).mockRejectedValue(stripeError);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await deleteUserAccount('user-1');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StripeCleanupError);
      expect((error as StripeCleanupError).message).toBe(
        'Stripe subscription cancellation failed during account deletion'
      );
      expect((error as StripeCleanupError).cause).toBe(stripeError);
    }

    // GDPR: user must still be deleted even though Stripe call failed
    expect(prisma.user.delete).toHaveBeenCalledOnce();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });

    consoleSpy.mockRestore();
  });

  it('should delete user without Stripe call when no subscription exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: null,
      subscription: null,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    await deleteUserAccount('user-2');

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } });
  });

  it('should throw for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(deleteUserAccount('nonexistent')).rejects.toThrow('User not found');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
