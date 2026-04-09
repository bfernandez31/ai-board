'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useRetroSpecPolling } from '@/app/lib/hooks/useRetroSpecPolling';
import { queryKeys } from '@/app/lib/query-keys';
import { RetroSpecModal } from './retro-spec-modal';

interface RetroSpecBadgeProps {
  projectId: number;
  defaultAgent?: 'CLAUDE' | 'CODEX';
}

export function RetroSpecBadge({ projectId, defaultAgent }: RetroSpecBadgeProps) {
  const { isGenerating, isCompleted, isFailed } = useRetroSpecPolling(projectId);
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  // Show "Specs ready" for 30s after completion, then fade out
  /* eslint-disable react-hooks/set-state-in-effect -- Timer-based state transition: show success badge then auto-hide after 30s */
  useEffect(() => {
    if (!isCompleted) return;
    setShowCompleted(true);
    const timer = setTimeout(() => setShowCompleted(false), 30_000);
    return () => clearTimeout(timer);
  }, [isCompleted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRetry = useCallback(() => setIsRetryModalOpen(true), []);

  if (!isGenerating && !showCompleted && !isFailed) {
    return null;
  }

  if (isGenerating) {
    return (
      <div
        data-testid="retro-spec-badge"
        className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-foreground">Generating specs...</span>
      </div>
    );
  }

  if (showCompleted) {
    return (
      <div
        data-testid="retro-spec-badge"
        className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm animate-in fade-in"
      >
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-foreground">Specs ready</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <>
        <div
          data-testid="retro-spec-badge"
          className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm"
        >
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-foreground">Spec generation failed</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 px-2 text-xs"
            onClick={handleRetry}
          >
            Retry
          </Button>
        </div>

        <RetroSpecModal
          open={isRetryModalOpen}
          onOpenChange={setIsRetryModalOpen}
          projectId={projectId}
          defaultAgent={defaultAgent}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.projects.retroSpecJob(projectId) })}
        />
      </>
    );
  }

  return null;
}
