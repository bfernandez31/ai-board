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
}

function formatUsd(value: number): string {
  return value < 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(2)}`;
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
}: InboxAnalysisButtonProps) {
  const exhausted = rateLimit.remaining <= 0;
  const disabled = !triggerable || exhausted || !!isPending || !!busy;
  const costLabel = `${formatUsd(estimatedCostUsd.lower)}–${formatUsd(estimatedCostUsd.upper)}`;
  const accessibleLabel = `Analyze ticket — estimated cost ${costLabel}`;

  const button = (
    <Button
      type="button"
      onClick={onTrigger}
      disabled={disabled}
      data-testid="inbox-analysis-trigger"
      aria-label={accessibleLabel}
      className="gap-2"
      size="sm"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>Analyze</span>
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        ({costLabel})
      </span>
    </Button>
  );

  if (exhausted && rateLimit.nextResetAt) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            Hourly budget exhausted. Capacity returns at {formatResetTime(rateLimit.nextResetAt)}.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
