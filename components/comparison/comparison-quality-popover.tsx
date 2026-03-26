'use client';

import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type {
  ComparisonEnrichmentValue,
  QualityScoreBreakdown,
} from '@/lib/types/comparison';

interface QualityScorePopoverProps {
  quality: ComparisonEnrichmentValue<number>;
  qualityDetails: ComparisonEnrichmentValue<QualityScoreBreakdown>;
}

export function QualityScorePopover({
  quality,
  qualityDetails,
}: QualityScorePopoverProps) {
  if (quality.state !== 'available' || quality.value == null) {
    return (
      <span className="text-sm text-muted-foreground">
        {quality.state === 'pending' ? 'Pending' : 'N/A'}
      </span>
    );
  }

  const hasDetails =
    qualityDetails.state === 'available' &&
    qualityDetails.value != null &&
    qualityDetails.value.dimensions.length > 0;

  const scoreDisplay = (
    <span className="text-sm font-medium text-foreground">{quality.value}</span>
  );

  if (!hasDetails) {
    return scoreDisplay;
  }

  const breakdown = qualityDetails.value!;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
        >
          {quality.value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Quality Score Breakdown
            </span>
            <Badge variant="outline">
              {breakdown.overall} {breakdown.label}
            </Badge>
          </div>
          <div className="space-y-2">
            {breakdown.dimensions.map((dimension) => (
              <div key={dimension.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{dimension.name}</span>
                  <span className="text-muted-foreground">
                    {dimension.score}/100 ({Math.round(dimension.weight * 100)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(dimension.score, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
