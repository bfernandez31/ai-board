'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScoreColor } from '@/lib/quality-score';
import type { ComparisonRankingProps } from './types';

function formatQualitySummary(participant: ComparisonRankingProps['participants'][number]) {
  if (participant.quality.score.state === 'available' && participant.quality.score.value != null) {
    return {
      label: `Quality ${participant.quality.score.value}`,
      threshold: participant.quality.thresholdLabel,
      className: getScoreColor(participant.quality.score.value).text,
    };
  }

  if (participant.quality.score.state === 'pending') {
    return {
      label: 'Quality Pending',
      threshold: null,
      className: 'text-muted-foreground',
    };
  }

  return {
    label: 'Quality N/A',
    threshold: null,
    className: 'text-muted-foreground',
  };
}

export function ComparisonRanking({
  participants,
  recommendation,
  summary,
  winnerTicketId,
  keyDifferentiators,
}: ComparisonRankingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking and Recommendation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{recommendation}</div>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        {keyDifferentiators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keyDifferentiators.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {participants.map((participant) => {
            const qualitySummary = formatQualitySummary(participant);

            return (
              <div
                key={participant.ticketId}
                className="rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div>
                      <div className="font-medium text-foreground">
                        #{participant.rank} {participant.ticketKey}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {participant.title}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{participant.workflowType}</Badge>
                      {participant.agent && (
                        <Badge variant="outline">{participant.agent}</Badge>
                      )}
                      {participant.quality.isBestValue && (
                        <Badge>Top quality</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={qualitySummary.className}>{qualitySummary.label}</span>
                      {qualitySummary.threshold && (
                        <Badge variant="outline">{qualitySummary.threshold}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.ticketId === winnerTicketId && <Badge>Winner</Badge>}
                    <Badge variant="outline">{participant.score}%</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {participant.rankRationale}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
