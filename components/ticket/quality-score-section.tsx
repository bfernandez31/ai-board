'use client';

import { useState } from 'react';
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
 * QualityScoreSection displays the overall quality score with a collapsible
 * dimension breakdown. Shows score + threshold label by default; click to
 * expand the 5 dimension scores with weights.
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
  const hasDimensions = details?.dimensions && details.dimensions.length > 0;

  return (
    <div className="mb-6" data-testid="quality-score-section">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Quality Score
      </h3>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-secondary/50 transition-colors"
          data-testid="quality-score-trigger"
          disabled={!hasDimensions}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${colors.text}`}
              data-testid="quality-score-value"
            >
              {score}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
            <span
              className={`text-sm font-semibold px-3 py-1 rounded-full ${colors.text} ${colors.bg}`}
              data-testid="quality-score-threshold"
            >
              {threshold}
            </span>
          </div>

          {hasDimensions && (
            isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </CollapsibleTrigger>

        {hasDimensions && (
          <CollapsibleContent className="pt-2">
            <div
              className="bg-card border border-border rounded-lg p-4 space-y-2"
              data-testid="dimension-breakdown"
            >
              {details!.dimensions.map((dim) => {
                const dimColors = getScoreColor(dim.score);
                return (
                  <div
                    key={dim.agentId}
                    className="flex items-center justify-between text-sm"
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
