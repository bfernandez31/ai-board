import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { stripe } from '@/lib/stripe/client';
import { getOrCreateStripeCustomerId } from '@/lib/stripe/subscription';
import { PLANS } from '@/lib/stripe/plans';

const checkoutSchema = z.object({
  plan: z.enum(['PRO', 'TEAM']),
});

/**
 * POST /api/stripe/checkout
 *
 * Create a Stripe Checkout session for subscribing to a plan.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const body = await request.json();
    const { plan } = checkoutSchema.parse(body);

    const planConfig = PLANS[plan];
    if (!planConfig.priceId) {
      return NextResponse.json(
        { error: 'Invalid plan configuration' },
        { status: 400 }
      );
    }

    const customerId = await getOrCreateStripeCustomerId(userId);

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000';

    const subscriptionData: Record<string, unknown> = {
      metadata: { userId, plan },
    };
    if (planConfig.trialDays > 0) {
      subscriptionData.trial_period_days = planConfig.trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      subscription_data: subscriptionData as Stripe.Checkout.SessionCreateParams.SubscriptionData,
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing?canceled=true`,
      metadata: { userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Failed to create checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
