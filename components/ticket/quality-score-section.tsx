'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getScoreThreshold,
  getScoreColor,
  parseQualityScoreDetails,
} from '@/lib/quality-score';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

interface QualityScoreSectionProps {
  jobs: TicketJobWithTelemetry[];
}

/**
 * QualityScoreSection displays the overall quality score, threshold label,
 * and breakdown of all 5 dimension scores with weights.
 * Renders only if the latest COMPLETED verify job has a quality score.
 */
export function QualityScoreSection({ jobs }: QualityScoreSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Find latest COMPLETED verify job with quality score
  const latestScoredJob = jobs
    .filter(
      (j) =>
        j.command === 'verify' &&
        j.status === 'COMPLETED' &&
        j.qualityScore != null
    )
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  if (!latestScoredJob || latestScoredJob.qualityScore == null) return null;

  const score = latestScoredJob.qualityScore;
  const threshold = getScoreThreshold(score);
  const colors = getScoreColor(score);
  const details = parseQualityScoreDetails(latestScoredJob.qualityScoreDetails);
  const dimensions = details?.dimensions ?? [];
  const hasDetails = dimensions.length > 0;

  return (
    <div className="mb-6" data-testid="quality-score-section">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Quality Score
      </h3>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className="w-full text-left"
          aria-label="Quality score details"
          disabled={!hasDetails}
        >
          <Card className="bg-background border-border mb-3 transition-colors hover:bg-secondary/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span
                      className={`text-3xl font-bold ${colors.text}`}
                      data-testid="quality-score-value"
                    >
                      {score}
                    </span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${colors.text} ${colors.bg}`}
                    data-testid="quality-score-threshold"
                  >
                    {threshold}
                  </span>
                </div>

                {hasDetails && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">
                      {isOpen ? 'Hide details' : 'View details'}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleTrigger>

        {hasDetails && (
          <CollapsibleContent className="pt-1">
            <div className="space-y-2" data-testid="dimension-breakdown">
              {dimensions.map((dim) => {
                const dimColors = getScoreColor(dim.score);
                return (
                  <div
                    key={dim.agentId}
                    className="flex items-center justify-between text-sm rounded-lg border border-border bg-card px-3 py-2"
                    data-testid={`dimension-${dim.agentId}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{dim.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({Math.round(dim.weight * 100)}%)
                      </span>
                    </div>
                    <span className={`font-semibold ${dimColors.text}`}>
                      {dim.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
