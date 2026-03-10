import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription, getUserPlan } from '@/lib/stripe/subscription';
import { PLANS } from '@/lib/stripe/plans';

/**
 * GET /api/stripe/subscription
 *
 * Get the current user's subscription details and plan info.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const subscription = await getUserSubscription(userId);
    const plan = await getUserPlan(userId);
    const planConfig = PLANS[plan];

    return NextResponse.json({
      plan,
      planConfig: {
        name: planConfig.name,
        price: planConfig.price,
        features: planConfig.features,
        limits: planConfig.limits,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            trialEnd: subscription.trialEnd?.toISOString() || null,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.error('Failed to fetch subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
