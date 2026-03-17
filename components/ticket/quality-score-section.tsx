'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';
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

  return (
    <div className="mb-6" data-testid="quality-score-section">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Quality Score
      </h3>

      {/* Overall Score Card */}
      <Card className="bg-background border-border mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
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
        </CardContent>
      </Card>

      {/* Dimension Breakdown */}
      {details?.dimensions && details.dimensions.length > 0 && (
        <div className="space-y-2" data-testid="dimension-breakdown">
          {details.dimensions.map((dim) => {
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
      )}
    </div>
  );
}
