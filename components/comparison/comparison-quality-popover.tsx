'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { QualityScoreDetails } from '@/lib/quality-score';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { ComparisonEnrichmentValue } from '@/lib/types/comparison';

interface ComparisonQualityPopoverProps {
  qualityBreakdown: ComparisonEnrichmentValue<QualityScoreDetails>;
  qualityScore: ComparisonEnrichmentValue<number>;
  formattedScore: string;
}

export function ComparisonQualityPopover({
  qualityBreakdown,
  qualityScore,
  formattedScore,
}: ComparisonQualityPopoverProps) {
  if (qualityBreakdown.state !== 'available' || !qualityBreakdown.value) {
    return <span>{formattedScore}</span>;
  }

  const details = qualityBreakdown.value;
  const overallScore = qualityScore.state === 'available' ? qualityScore.value : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
          aria-label="View quality score breakdown"
        >
          {formattedScore}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Quality Score Breakdown</h4>
          <div className="space-y-2">
            {details.dimensions.map((dimension) => {
              const colors = getScoreColor(dimension.score);
              return (
                <div key={dimension.agentId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{dimension.name}</span>
                    <span className="font-medium text-foreground">
                      {dimension.score}
                      <span className="ml-1 text-muted-foreground">
                        ({(dimension.weight * 100).toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${colors.fill}`}
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {overallScore != null && (
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Overall</span>
                <span className="font-medium text-foreground">
                  {overallScore} {getScoreThreshold(overallScore)}
                </span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
