'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubscriptionPlan } from '@prisma/client';
import type { PlanLimits } from '@/lib/billing/plans';

export interface SubscriptionData {
  plan: SubscriptionPlan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  gracePeriodEndsAt: string | null;
  limits: PlanLimits;
}

async function fetchSubscription(): Promise<SubscriptionData> {
  const res = await fetch('/api/billing/subscription');
  if (!res.ok) {
    throw new Error('Failed to fetch subscription');
  }
  return res.json();
}

export const subscriptionKeys = {
  all: ['subscription'] as const,
  current: () => ['subscription', 'current'] as const,
};

export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: fetchSubscription,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
