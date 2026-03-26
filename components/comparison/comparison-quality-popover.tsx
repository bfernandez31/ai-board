'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { ComparisonQualityPopoverProps } from './types';

export function ComparisonQualityPopover({
  qualityDetails,
  qualityScore,
}: ComparisonQualityPopoverProps) {
  if (!qualityDetails || qualityScore == null) {
    return null;
  }

  const scoreColor = getScoreColor(qualityScore);
  const threshold = getScoreThreshold(qualityScore);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {qualityScore} {threshold}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Quality Score Breakdown
          </div>
          <div className="space-y-2">
            {qualityDetails.dimensions.map((dimension) => (
              <div key={dimension.agentId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{dimension.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {dimension.score}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(dimension.weight * 100)}%
                    </span>
                  </div>
                </div>
                <Progress value={dimension.score} className="h-1.5" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs font-medium text-muted-foreground">
              Overall
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold text-foreground"
                data-testid="quality-popover-overall"
              >
                {qualityScore}
              </span>
              <span
                className={`text-xs font-medium ${scoreColor.text}`}
                data-testid="quality-popover-threshold"
              >
                {threshold}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
