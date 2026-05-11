import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRetroSpecPolling } from '@/app/lib/hooks/useRetroSpecPolling';
import { queryKeys } from '@/app/lib/query-keys';

interface UseRetroSpecStateArgs {
  projectId: number;
  hasSpecs: boolean;
}

/**
 * AIB-585: Retro-spec generation lifecycle. Resumes polling after refresh via
 * localStorage flag, clears it on terminal states, and exposes banner + modal state.
 */
export function useRetroSpecState({ projectId, hasSpecs }: UseRetroSpecStateArgs) {
  const queryClient = useQueryClient();
  const retroSpecActiveKey = `retro-spec-active-${projectId}`;

  const [retroSpecPollingEnabled, setRetroSpecPollingEnabled] = useState(() => {
    if (hasSpecs) return false;
    try { return localStorage.getItem(retroSpecActiveKey) === 'true'; } catch { return false; }
  });

  const {
    isGenerating: isRetroSpecGenerating,
    isCompleted: isRetroSpecCompleted,
    isFailed: isRetroSpecFailed,
    job: retroSpecJob,
  } = useRetroSpecPolling(projectId, 2000, retroSpecPollingEnabled);

  // Clear active flag when generation reaches a terminal state
  useEffect(() => {
    if (isRetroSpecCompleted || isRetroSpecFailed) {
      setRetroSpecPollingEnabled(false);
      try { localStorage.removeItem(retroSpecActiveKey); } catch {}
    }
  }, [isRetroSpecCompleted, isRetroSpecFailed, retroSpecActiveKey]);

  const [isRetroSpecModalOpen, setIsRetroSpecModalOpen] = useState(false);
  const [isBannerDismissed] = useState(() => {
    try { return localStorage.getItem(`retro-spec-banner-dismissed-${projectId}`) === 'true'; } catch { return false; }
  });

  const handleRetroSpecSuccess = useCallback(() => {
    setRetroSpecPollingEnabled(true);
    try { localStorage.setItem(retroSpecActiveKey, 'true'); } catch {}
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.retroSpecJob(projectId) });
  }, [queryClient, projectId, retroSpecActiveKey]);

  return {
    isRetroSpecGenerating,
    isRetroSpecCompleted,
    isRetroSpecFailed,
    retroSpecJob,
    isRetroSpecModalOpen,
    setIsRetroSpecModalOpen,
    isBannerDismissed,
    handleRetroSpecSuccess,
  };
}
