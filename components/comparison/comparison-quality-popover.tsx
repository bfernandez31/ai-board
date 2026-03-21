'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { ComparisonQualityPopoverProps } from './types';

export function ComparisonQualityPopover({
  score,
  details,
  workflowType,
}: ComparisonQualityPopoverProps) {
  const threshold = getScoreThreshold(score);
  const color = getScoreColor(score);
  const label = `${score} ${threshold}`;

  if (workflowType !== 'FULL' || !details) {
    return <span>{label}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`cursor-pointer font-medium underline decoration-dotted underline-offset-2 ${color.text}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Score</span>
            <span className={`text-sm font-semibold ${color.text}`}>
              {score} {threshold}
            </span>
          </div>
          <div className="space-y-2">
            {details.dimensions.map((dimension) => {
              const dimColor = getScoreColor(dimension.score);
              return (
                <div key={dimension.agentId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{dimension.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={dimColor.text}>{dimension.score}</span>
                      <span className="text-muted-foreground">
                        ({Math.round(dimension.weight * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${dimColor.bg.replace('/10', '')}`}
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
