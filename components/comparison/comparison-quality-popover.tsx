'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  getScoreColor,
  getScoreThreshold,
  type QualityScoreDetails,
} from '@/lib/quality-score';

interface ComparisonQualityPopoverProps {
  score: number;
  details: QualityScoreDetails;
  children: React.ReactNode;
}

export function ComparisonQualityPopover({
  score,
  details,
  children,
}: ComparisonQualityPopoverProps) {
  const overallColor = getScoreColor(score);
  const overallLabel = getScoreThreshold(score);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Quality Breakdown</span>
            <Badge variant="outline" className={`${overallColor.text} ${overallColor.bg}`}>
              {score} {overallLabel}
            </Badge>
          </div>

          <div className="space-y-2">
            {details.dimensions
              .slice()
              .sort((a, b) => {
                const aOrder = a.agentId === 'compliance' ? 1 : a.agentId === 'bug-detection' ? 2 : a.agentId === 'code-comments' ? 3 : a.agentId === 'historical-context' ? 4 : 5;
                const bOrder = b.agentId === 'compliance' ? 1 : b.agentId === 'bug-detection' ? 2 : b.agentId === 'code-comments' ? 3 : b.agentId === 'historical-context' ? 4 : 5;
                return aOrder - bOrder;
              })
              .map((dimension) => {
                const dimColor = getScoreColor(dimension.score);
                return (
                  <div key={dimension.agentId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {dimension.name}
                        {dimension.weight > 0 && (
                          <span className="ml-1 text-muted-foreground/60">
                            ({Math.round(dimension.weight * 100)}%)
                          </span>
                        )}
                      </span>
                      <span className={`font-medium ${dimColor.text}`}>
                        {dimension.score}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${dimColor.bg.replace('/10', '/40')}`}
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
