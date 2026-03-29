'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

export interface GeneratedTicketItem {
  id: number;
  ticketKey: string;
  title: string;
  stage: string;
}

interface GeneratedTicketsResponse {
  tickets: GeneratedTicketItem[];
}

export function useGeneratedTickets(projectId: number, scanId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.health.generatedTickets(projectId, scanId ?? 0),
    queryFn: async (): Promise<GeneratedTicketsResponse> => {
      const response = await fetch(
        `/api/projects/${projectId}/health/scans/${scanId}/tickets`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && scanId !== null,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
