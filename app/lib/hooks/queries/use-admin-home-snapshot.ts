'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DashboardSnapshot } from '@/app/lib/admin/home/types';

const QUERY_KEY = ['admin', 'home', 'snapshot'] as const;

export function useAdminHomeSnapshot(initialData: DashboardSnapshot) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DashboardSnapshot> => {
      const response = await fetch('/api/admin/home', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch admin home snapshot: HTTP ${response.status}`);
      }
      return (await response.json()) as DashboardSnapshot;
    },
    initialData,
    refetchInterval: 30_000,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export const adminHomeSnapshotQueryKey = QUERY_KEY;
