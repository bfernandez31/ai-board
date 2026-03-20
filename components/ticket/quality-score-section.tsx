'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  getScoreColor,
  getScoreThreshold,
  normalizeDimensionForDisplay,
  parseQualityScoreDetails,
  sortDimensionsForDisplay,
} from '@/lib/quality-score';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

interface QualityScoreSectionProps {
  jobs: TicketJobWithTelemetry[];
}

function getLatestScoredVerifyJob(
  jobs: TicketJobWithTelemetry[]
): TicketJobWithTelemetry | null {
  let latestScoredJob: TicketJobWithTelemetry | null = null;

  for (const job of jobs) {
    if (
      job.command !== 'verify' ||
      job.status !== 'COMPLETED' ||
      job.qualityScore == null
    ) {
      continue;
    }

    if (
      latestScoredJob == null ||
      new Date(job.startedAt).getTime() > new Date(latestScoredJob.startedAt).getTime()
    ) {
      latestScoredJob = job;
    }
  }

  return latestScoredJob;
}

/**
 * QualityScoreSection displays the overall quality score, threshold label,
 * and breakdown of all 5 dimension scores with weights.
 * Renders only if the latest COMPLETED verify job has a quality score.
 */
export function QualityScoreSection({
  jobs,
}: QualityScoreSectionProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const latestScoredJob = getLatestScoredVerifyJob(jobs);

  if (!latestScoredJob || latestScoredJob.qualityScore == null) return null;

  const score = latestScoredJob.qualityScore;
  const threshold = getScoreThreshold(score);
  const colors = getScoreColor(score);
  const details = parseQualityScoreDetails(latestScoredJob.qualityScoreDetails);
  const dimensions = sortDimensionsForDisplay(
    (details?.dimensions ?? []).map((dimension) => normalizeDimensionForDisplay(dimension))
  );
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
                    {isOpen && <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    {!isOpen && (
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
