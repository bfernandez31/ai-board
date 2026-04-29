'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface InboxAnalysisButtonProps {
  triggerable: boolean;
  estimatedCostUsd: { lower: number; upper: number };
  rateLimit: { remaining: number; nextResetAt: string | null };
  onTrigger: () => void;
  isPending?: boolean;
  busy?: boolean;
  showCost?: boolean;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatResetTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function InboxAnalysisButton({
  triggerable,
  estimatedCostUsd,
  rateLimit,
  onTrigger,
  isPending,
  busy,
  showCost = true,
}: InboxAnalysisButtonProps) {
  const exhausted = rateLimit.remaining <= 0;
  const disabled = !triggerable || exhausted || !!isPending || !!busy;
  const costLabel = `${formatUsd(estimatedCostUsd.lower)}–${formatUsd(estimatedCostUsd.upper)}`;
  const accessibleLabel = showCost
    ? `Run analysis — estimated cost ${costLabel}`
    : 'Run analysis';

  const button = (
    <Button
      type="button"
      onClick={onTrigger}
      disabled={disabled}
      data-testid="inbox-analysis-trigger"
      aria-label={accessibleLabel}
      className="h-7 gap-1.5 px-2.5 text-xs"
      size="sm"
      variant="outline"
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      <span>Run analysis</span>
    </Button>
  );

  if (exhausted && rateLimit.nextResetAt) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            Hourly budget exhausted. Capacity returns at {formatResetTime(rateLimit.nextResetAt)}.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (showCost) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>Estimated cost {costLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
