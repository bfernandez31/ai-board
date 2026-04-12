'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { RetroSpecModal } from './retro-spec-modal';
import type { RetroSpecJobDto } from '@/app/lib/hooks/useRetroSpecPolling';

interface RetroSpecBadgeProps {
  projectId: number;
  isGenerating: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  job: RetroSpecJobDto | null;
  defaultAgent?: import('@prisma/client').Agent;
  onRetrySuccess?: () => void;
}

export function RetroSpecBadge({ projectId, isGenerating, isCompleted, isFailed, job, defaultAgent, onRetrySuccess }: RetroSpecBadgeProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  // Show "Specs ready" only if job completed within the last 30s, then fade out
  /* eslint-disable react-hooks/set-state-in-effect -- Timer-based state transition: show success badge then auto-hide after 30s */
  useEffect(() => {
    if (!isCompleted || !job?.completedAt) return;
    const elapsed = Date.now() - new Date(job.completedAt).getTime();
    if (elapsed >= 30_000) return;
    setShowCompleted(true);
    const remaining = Math.max(0, 30_000 - elapsed);
    const timer = setTimeout(() => setShowCompleted(false), remaining);
    return () => clearTimeout(timer);
  }, [isCompleted, job?.completedAt]);
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
          onSuccess={() => onRetrySuccess?.()}
        />
      </>
    );
  }

  return null;
}
