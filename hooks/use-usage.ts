'use client';

import { useQuery } from '@tanstack/react-query';
import type { SubscriptionPlan } from '@prisma/client';

export interface UsageData {
  plan: SubscriptionPlan;
  planName: string;
  projects: {
    current: number;
    max: number | null;
  };
  ticketsThisMonth: {
    current: number;
    max: number | null;
    resetDate: string;
  };
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  gracePeriodEndsAt: string | null;
}

async function fetchUsage(): Promise<UsageData> {
  const res = await fetch('/api/billing/usage');
  if (!res.ok) {
    throw new Error('Failed to fetch usage');
  }
  return res.json();
}

export const usageKeys = {
  all: ['usage'] as const,
  current: () => ['usage', 'current'] as const,
};

export function useUsage() {
  return useQuery({
    queryKey: usageKeys.current(),
    queryFn: fetchUsage,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
