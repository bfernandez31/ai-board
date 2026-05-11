import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Job } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import { queryKeys } from '@/app/lib/query-keys';

interface UseBoardCacheSeedingArgs {
  projectId: number;
  initialTicketsByStage: Record<Stage, TicketWithVersion[]>;
  initialJobs: Map<number, Job[]>;
  initialShipTotal: number;
}

/**
 * Seeds the TanStack Query cache with server-fetched data so the board renders
 * without a loading state on first paint. Tickets, ship totals, and per-ticket
 * job lists all get pre-populated.
 */
export function useBoardCacheSeeding({
  projectId,
  initialTicketsByStage,
  initialJobs,
  initialShipTotal,
}: UseBoardCacheSeedingArgs) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(
      queryKeys.projects.tickets(projectId),
      Object.values(initialTicketsByStage).flat()
    );
    queryClient.setQueryData(
      queryKeys.projects.shipTotal(projectId),
      initialShipTotal
    );
  }, [projectId, initialTicketsByStage, initialShipTotal, queryClient]);

  // T008: Seed ticket jobs cache with server data for immediate reactivity
  useEffect(() => {
    for (const [ticketId, jobs] of initialJobs.entries()) {
      if (jobs.length > 0) {
        queryClient.setQueryData(
          queryKeys.projects.ticketJobs(projectId, ticketId),
          jobs
        );
      }
    }
  }, [projectId, initialJobs, queryClient]);
}
