import type { SubscriptionPlan } from '@prisma/client';
import { PLANS, type PlanLimits } from './plans';
import { findSubscriptionByUserId } from '@/lib/db/subscriptions';

export interface UserSubscriptionInfo {
  plan: SubscriptionPlan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  gracePeriodEndsAt: string | null;
  limits: PlanLimits;
}

export async function getUserSubscription(
  userId: string
): Promise<UserSubscriptionInfo> {
  const subscription = await findSubscriptionByUserId(userId);

  if (!subscription) {
    return {
      plan: 'FREE',
      status: 'none',
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAt: null,
      gracePeriodEndsAt: null,
      limits: PLANS.FREE.limits,
    };
  }

  const effectivePlan = getEffectivePlan(
    subscription.plan,
    subscription.status,
    subscription.gracePeriodEndsAt
  );

  return {
    plan: subscription.plan,
    status: subscription.status.toLowerCase() as UserSubscriptionInfo['status'],
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    trialEnd: subscription.trialEnd?.toISOString() ?? null,
    cancelAt: subscription.cancelAt?.toISOString() ?? null,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() ?? null,
    limits: getPlanLimits(effectivePlan),
  };
}

export function getEffectivePlan(
  plan: SubscriptionPlan,
  status: string,
  gracePeriodEndsAt: Date | null
): SubscriptionPlan {
  if (status === 'CANCELED') {
    return 'FREE';
  }

  if (status === 'PAST_DUE' && gracePeriodEndsAt) {
    if (new Date() > gracePeriodEndsAt) {
      return 'FREE';
    }
  }

  return plan;
}

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLANS[plan].limits;
}
