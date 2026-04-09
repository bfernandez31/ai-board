'use client';

import { useState, useCallback } from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpecGenPolling } from '@/app/lib/hooks/useSpecGenPolling';
import { SpecGenModal } from './spec-gen-modal';

interface SpecGenBannerProps {
  projectId: number;
}

function getStorageKey(projectId: number) {
  return `spec-banner-dismissed-${projectId}`;
}

export function SpecGenBanner({ projectId }: SpecGenBannerProps) {
  const { job } = useSpecGenPolling(projectId);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(getStorageKey(projectId)) === 'true';
    } catch {
      return false;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isJobActive = job?.status === 'PENDING' || job?.status === 'RUNNING';

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(getStorageKey(projectId), 'true');
    } catch {
      // sessionStorage unavailable
    }
  }, [projectId]);

  // Don't show if dismissed, or if a job is active/completed
  if (isDismissed || isJobActive || job?.status === 'COMPLETED') return null;

  return (
    <>
      <div
        role="banner"
        className="flex items-center justify-between gap-3 rounded-lg border border-ctp-mauve/20 bg-ctp-mauve/5 px-4 py-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-ctp-mauve shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-medium">Project specs not generated</span>
            <span className="text-muted-foreground">
              {' — Specs improve health scans, ticket workflows, and code review quality'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Generate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            aria-label="Dismiss spec generation banner"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SpecGenModal
        projectId={projectId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
