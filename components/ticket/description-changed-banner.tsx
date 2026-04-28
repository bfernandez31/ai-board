'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DescriptionChangedBannerProps {
  onReanalyze: () => void;
  disabled?: boolean;
}

export function DescriptionChangedBanner({
  onReanalyze,
  disabled,
}: DescriptionChangedBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="description-changed-banner"
      className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <p className="text-sm text-foreground">
        Description changed since last analysis — the panel below may be out of date.
      </p>
      <Button
        size="sm"
        variant="default"
        onClick={onReanalyze}
        disabled={disabled}
        data-testid="reanalyze-button"
        aria-label="Re-analyze ticket"
      >
        <RefreshCcw className="mr-2 h-3 w-3" aria-hidden="true" />
        Re-analyze
      </Button>
    </div>
  );
}
