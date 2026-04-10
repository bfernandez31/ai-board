'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileSearch } from 'lucide-react';
import { RetroSpecModal } from './retro-spec-modal';

interface RetroSpecBannerProps {
  projectId: number;
  hasSpecs: boolean;
  isGenerating: boolean;
  isFailed?: boolean;
  defaultAgent?: 'CLAUDE' | 'CODEX';
  onGenerateSuccess?: (() => void) | undefined;
}

function getDismissalKey(projectId: number): string {
  return `retro-spec-banner-dismissed-${projectId}`;
}

function getIsDismissed(projectId: number): boolean {
  try {
    return localStorage.getItem(getDismissalKey(projectId)) === 'true';
  } catch {
    return false;
  }
}

// No-op subscribe — localStorage changes don't fire events on same page
const subscribeNoop = () => () => {};

export function RetroSpecBanner({ projectId, hasSpecs, isGenerating, isFailed, defaultAgent, onGenerateSuccess }: RetroSpecBannerProps) {
  const isDismissedFromStorage = useSyncExternalStore(
    subscribeNoop,
    () => getIsDismissed(projectId),
    () => false
  );
  const [isDismissedLocal, setIsDismissedLocal] = useState(false);
  const isDismissed = isDismissedFromStorage || isDismissedLocal;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show banner if specs exist, dismissed, actively generating, or failed (badge handles retry)
  if (hasSpecs || isDismissed || isGenerating || isFailed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissedLocal(true);
    try {
      localStorage.setItem(getDismissalKey(projectId), 'true');
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <>
      <div
        data-testid="retro-spec-banner"
        className="mx-4 mt-2 mb-1 rounded-md border border-primary/30 bg-primary/5 px-4 py-3"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileSearch className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm min-w-0">
              <span className="font-medium text-foreground">Project specs not generated</span>
              <span className="text-muted-foreground hidden sm:inline"> — Specs improve health scans, ticket workflows, and code review quality</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsModalOpen(true)}
              data-testid="retro-spec-generate-btn"
            >
              Generate
            </Button>
            <button
              onClick={handleDismiss}
              className="rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Dismiss spec generation banner"
              data-testid="retro-spec-dismiss-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <RetroSpecModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        projectId={projectId}
        defaultAgent={defaultAgent}
        onSuccess={onGenerateSuccess}
      />
    </>
  );
}
