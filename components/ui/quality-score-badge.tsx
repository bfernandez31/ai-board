'use client';

import { getQualityTierConfig } from '@/lib/utils/quality-score';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QualityScoreBadgeProps {
  score: number;
  /** Compact mode for ticket cards (score only) */
  compact?: boolean;
}

/**
 * Displays a quality score as a colored badge.
 * Compact mode shows just the number; full mode shows label + number.
 */
export function QualityScoreBadge({ score, compact = false }: QualityScoreBadgeProps) {
  const config = getQualityTierConfig(score);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="quality-score-badge"
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold border',
              config.textColor,
              config.bgColor,
              config.borderColor
            )}
          >
            {score}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Quality Score: {score} ({config.label})
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      data-testid="quality-score-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold border',
        config.textColor,
        config.bgColor,
        config.borderColor
      )}
    >
      <span>{score}</span>
      <span className="text-xs font-medium opacity-80">{config.label}</span>
    </div>
  );
}
