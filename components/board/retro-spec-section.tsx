'use client';

import { Agent } from '@prisma/client';
import { RetroSpecBanner } from './retro-spec-banner';
import { RetroSpecBadge } from './retro-spec-badge';
import type { RetroSpecJobDto } from '@/app/lib/hooks/useRetroSpecPolling';

interface RetroSpecSectionProps {
  projectId: number;
  hasSpecs: boolean;
  defaultAgent: Agent;
  isRetroSpecGenerating: boolean;
  isRetroSpecCompleted: boolean;
  isRetroSpecFailed: boolean;
  retroSpecJob: RetroSpecJobDto | null;
  onRetroSpecSuccess: () => void;
}

/**
 * AIB-585: Top-of-board banner + corner badge for retro-spec generation lifecycle.
 * Banner is the primary entry point; badge surfaces progress and retry affordances
 * once the banner is dismissed.
 */
export function RetroSpecSection({
  projectId,
  hasSpecs,
  defaultAgent,
  isRetroSpecGenerating,
  isRetroSpecCompleted,
  isRetroSpecFailed,
  retroSpecJob,
  onRetroSpecSuccess,
}: RetroSpecSectionProps) {
  return (
    <>
      <RetroSpecBanner
        projectId={projectId}
        hasSpecs={hasSpecs || isRetroSpecCompleted}
        isGenerating={isRetroSpecGenerating}
        isFailed={isRetroSpecFailed}
        onGenerateSuccess={onRetroSpecSuccess}
        defaultAgent={defaultAgent}
      />
      {!hasSpecs && (
        <RetroSpecBadge
          projectId={projectId}
          isGenerating={isRetroSpecGenerating}
          isCompleted={isRetroSpecCompleted}
          isFailed={isRetroSpecFailed}
          job={retroSpecJob}
          defaultAgent={defaultAgent}
          onRetrySuccess={onRetroSpecSuccess}
        />
      )}
    </>
  );
}
