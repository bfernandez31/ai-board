'use client';

import { useQuery } from '@tanstack/react-query';

export interface UsageData {
  projects: { current: number; limit: number | null };
  ticketsThisMonth: { current: number; limit: number | null };
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
    staleTime: 10_000,
  });
}
