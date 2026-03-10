import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/billing/stripe';
import { prisma } from '@/lib/db/client';
import { getPlanByPriceId } from '@/lib/billing/plans';
import {
  upsertSubscription,
  deleteSubscription,
  createStripeEvent,
  isEventProcessed,
} from '@/lib/db/subscriptions';

// Helper to extract subscription ID from invoice's parent in Stripe v20
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.subscription_details?.subscription) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === 'string' ? sub : sub.id;
  }
  return null;
}

// Helper to get period dates from a Stripe subscription (v20 uses latest_invoice)
async function getSubscriptionPeriod(subscriptionId: string): Promise<{
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
}> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  // In Stripe v20, period info comes from the latest invoice or billing_cycle_anchor
  // Use the invoice's period_start/period_end or fall back to start_date
  const latestInvoice = sub.latest_invoice;
  let periodStart = sub.start_date * 1000;
  let periodEnd = periodStart + 30 * 24 * 60 * 60 * 1000; // default 30 days

  if (latestInvoice && typeof latestInvoice !== 'string') {
    periodStart = latestInvoice.period_start * 1000;
    periodEnd = latestInvoice.period_end * 1000;
  }

  return {
    currentPeriodStart: new Date(periodStart),
    currentPeriodEnd: new Date(periodEnd),
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, skipped: 'duplicate' }, { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        return NextResponse.json({ received: true }, { status: 200 });
    }

    await createStripeEvent(event.id, event.type);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler error for ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId || session.mode !== 'subscription') return;

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price?.id;
  if (!priceId) return;

  const planConfig = getPlanByPriceId(priceId);
  const plan = planConfig?.plan ?? 'PRO';

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;

  if (customerId) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const period = await getSubscriptionPeriod(subscriptionId);

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    plan,
    status: stripeSubscription.status === 'trialing' ? 'TRIALING' : 'ACTIVE',
    ...period,
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!sub) return;

  const period = await getSubscriptionPeriod(subscriptionId);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      gracePeriodEndsAt: null,
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!sub) return;

  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      status: 'PAST_DUE',
      gracePeriodEndsAt: gracePeriodEnd,
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!sub) return;

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;

  const planConfig = getPlanByPriceId(priceId);
  const plan = planConfig?.plan ?? sub.plan;

  // Team-to-lower downgrade protection
  if (sub.plan === 'TEAM' && plan !== 'TEAM') {
    const memberCount = await prisma.projectMember.count({
      where: {
        project: { userId: sub.userId },
        user: { email: { not: 'ai-board@system.local' } },
      },
    });
    if (memberCount > 0) {
      // Revert the subscription in Stripe to keep DB and Stripe in sync
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: subscription.items.data[0]!.id, price: sub.stripePriceId }],
      });
      console.warn(`Blocked downgrade from TEAM for user ${sub.userId}: ${memberCount} active members — reverted in Stripe`);
      return;
    }
  }

  let status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  switch (subscription.status) {
    case 'active':
      status = 'ACTIVE';
      break;
    case 'trialing':
      status = 'TRIALING';
      break;
    case 'past_due':
      status = 'PAST_DUE';
      break;
    case 'canceled':
      status = 'CANCELED';
      break;
    default:
      status = 'INCOMPLETE';
  }

  const period = await getSubscriptionPeriod(subscription.id);

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      plan,
      stripePriceId: priceId,
      status,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAt: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : null,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      trialStart: period.trialStart,
      trialEnd: period.trialEnd,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true },
  });
  if (existingSub) {
    await deleteSubscription(existingSub.userId);
  }
}
