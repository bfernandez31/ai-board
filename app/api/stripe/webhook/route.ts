import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { prisma } from '@/lib/db/client';
import { getPlanFromPriceId } from '@/lib/stripe/plans';
import type { SubscriptionStatus } from '@prisma/client';

/**
 * Map Stripe subscription status to our SubscriptionStatus enum.
 */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'incomplete':
    case 'incomplete_expired':
      return 'INCOMPLETE';
    default:
      return 'CANCELED';
  }
}

/**
 * Upsert subscription record from a Stripe subscription object.
 */
async function upsertSubscription(stripeSubscription: Stripe.Subscription) {
  const userId = stripeSubscription.metadata.userId;
  if (!userId) {
    console.error('No userId in subscription metadata', {
      subscriptionId: stripeSubscription.id,
    });
    return;
  }

  const firstItem = stripeSubscription.items.data[0];
  if (!firstItem) {
    console.error('No items in subscription', {
      subscriptionId: stripeSubscription.id,
    });
    return;
  }

  const priceId = firstItem.price.id;
  const plan = getPlanFromPriceId(priceId);
  const status = mapStripeStatus(stripeSubscription.status);

  // In Stripe v20, current_period dates are on the subscription item
  const sharedFields = {
    stripePriceId: priceId,
    plan,
    status,
    currentPeriodStart: new Date(firstItem.current_period_start * 1000),
    currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    trialStart: stripeSubscription.trial_start
      ? new Date(stripeSubscription.trial_start * 1000)
      : null,
    trialEnd: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
  };

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: stripeSubscription.id },
    create: {
      userId,
      stripeSubscriptionId: stripeSubscription.id,
      ...sharedFields,
    },
    update: sharedFields,
  });
}

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events for subscription lifecycle.
 * Must use raw body for signature verification.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: 'CANCELED' },
        });
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Could send notification to user about trial ending
        // For now, just log it
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Trial ending soon for subscription:', subscription.id);
        break;
      }

      default:
        // Unhandled event type - acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
