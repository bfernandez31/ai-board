'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';

type SetupState = 'NEEDS_SETUP' | 'IN_PROGRESS' | 'COMPLETED' | 'SYNC_FAILED' | 'FAILED' | 'CONFIGURED';

interface LatestJob {
  id: number;
  agent: 'CLAUDE' | 'CODEX';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  logs: string | null;
  artifactSummary: unknown | null;
  startedAt: string;
  completedAt: string | null;
}

interface SetupStatusResponse {
  setupState: SetupState;
  latestJob: LatestJob | null;
  configSyncedAt: string | null;
}

export interface UseSetupPollingReturn {
  setupState: SetupState | null;
  latestJob: LatestJob | null;
  isPolling: boolean;
}

const TERMINAL_SETUP_STATES = new Set<SetupState>(['CONFIGURED', 'COMPLETED', 'SYNC_FAILED', 'FAILED']);

export function useSetupPolling(
  projectId: number,
  pollingInterval: number = 2000
): UseSetupPollingReturn {
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.projects.setupStatus(projectId),
    queryFn: async (): Promise<SetupStatusResponse> => {
      const response = await fetch(`/api/projects/${projectId}/setup`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const setupState = query.state.data?.setupState;
      if (setupState && TERMINAL_SETUP_STATES.has(setupState)) {
        return false;
      }
      return pollingInterval;
    },
    refetchIntervalInBackground: true,
  });

  const setupState = data?.setupState ?? null;
  const isTerminal = setupState !== null && TERMINAL_SETUP_STATES.has(setupState);

  return {
    setupState,
    latestJob: data?.latestJob ?? null,
    isPolling: isFetching || !isTerminal,
  };
}
