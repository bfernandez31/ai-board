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

const AGENT_DISPLAY_ORDER: Record<string, number> = {
  compliance: 1,
  'bug-detection': 2,
  'code-comments': 3,
  'historical-context': 4,
};

function getAgentOrder(agentId: string): number {
  return AGENT_DISPLAY_ORDER[agentId] ?? 5;
}

function getBarColor(bgClass: string): string {
  return bgClass.replace('/10', '/40');
}

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

  const sortedDimensions = details.dimensions
    .slice()
    .sort((a, b) => getAgentOrder(a.agentId) - getAgentOrder(b.agentId));

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
            {sortedDimensions.map((dimension) => {
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
                      className={`h-full rounded-full transition-all ${getBarColor(dimColor.bg)}`}
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
