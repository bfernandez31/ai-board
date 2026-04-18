'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import { getNextStage, type Stage } from '@/lib/stage-transitions';
import type { JobStatus } from '@prisma/client';

interface AutoModeToggleVariables {
  ticketId: number;
  enabled: boolean;
  version: number;
  currentStage: Stage;
  hasRunningJob: boolean;
}

export function isRunningJob(status: JobStatus): boolean {
  return status === 'PENDING' || status === 'RUNNING';
}

export function useAutoMode(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: AutoModeToggleVariables) => {
      const { ticketId, enabled, version, currentStage, hasRunningJob } = variables;

      const patchResponse = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoMode: enabled, version }),
        }
      );

      if (!patchResponse.ok) {
        const error = await patchResponse.json();
        throw new Error(error.error || 'Failed to toggle auto-transition');
      }

      const updatedTicket = (await patchResponse.json()) as TicketWithVersion;

      if (enabled && !hasRunningJob) {
        const nextStage = getNextStage(currentStage);
        if (nextStage) {
          await dispatchNextStage(projectId, ticketId, nextStage, updatedTicket.version);
        }
      }

      return updatedTicket;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
    },

    onError: (error) => {
      console.error('[useAutoMode] Error:', error);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) });
    },

    retry: false,
  });
}

async function dispatchNextStage(
  projectId: number,
  ticketId: number,
  targetStage: Stage,
  version: number
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/transition`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStage, version }),
    }
  );

  if (!response.ok) {
    // Dispatch failed: disable autoMode to mirror the server-side failure rule.
    await disableAutoModeAfterFailure(projectId, ticketId);
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to dispatch next stage');
  }
}

async function disableAutoModeAfterFailure(
  projectId: number,
  ticketId: number
): Promise<void> {
  const ticketUrl = `/api/projects/${projectId}/tickets/${ticketId}`;
  const refetched = await fetch(ticketUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!refetched.ok) return;

  const ticket = (await refetched.json()) as TicketWithVersion;
  await fetch(ticketUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoMode: false, version: ticket.version }),
  });
}
