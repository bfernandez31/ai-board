import { useMemo } from 'react';
import { Job } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import { getDeletionBlockReason } from '@/lib/utils/trash-zone-eligibility';

export interface ZoneState {
  isVisible: boolean;
  isDisabled: boolean;
  disabledReason?: string;
}

interface UseZoneStatesArgs {
  activeTicket: TicketWithVersion | null;
  isDragging: boolean;
  getMergedTicketJobs: (ticketId: number) => Job[];
}

/**
 * Visibility + disabled state for the trash zone (T024) and close zone (AIB-148).
 * Both surfaces appear only during drag and reflect per-ticket eligibility.
 */
export function useZoneStates({
  activeTicket,
  isDragging,
  getMergedTicketJobs,
}: UseZoneStatesArgs): { trashZone: ZoneState; closeZone: ZoneState } {
  const trashZone = useMemo<ZoneState>(() => {
    if (!activeTicket || !isDragging) {
      return { isVisible: false, isDisabled: false };
    }
    const allTicketJobs = getMergedTicketJobs(activeTicket.id);
    const reason = getDeletionBlockReason({
      stage: activeTicket.stage,
      jobs: allTicketJobs.map(j => ({ status: j.status })),
    });
    return {
      isVisible: true,
      isDisabled: reason !== null,
      ...(reason && { disabledReason: reason }),
    };
  }, [activeTicket, isDragging, getMergedTicketJobs]);

  const closeZone = useMemo<ZoneState>(() => {
    if (!activeTicket || !isDragging || activeTicket.stage !== Stage.VERIFY) {
      return { isVisible: false, isDisabled: false };
    }
    const allTicketJobs = getMergedTicketJobs(activeTicket.id);
    const hasActiveJob = allTicketJobs.some(j => ['PENDING', 'RUNNING'].includes(j.status));
    if (hasActiveJob) {
      return { isVisible: true, isDisabled: true, disabledReason: 'Cannot close ticket with active jobs' };
    }
    return { isVisible: true, isDisabled: false };
  }, [activeTicket, isDragging, getMergedTicketJobs]);

  return { trashZone, closeZone };
}
