'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonRankingProps } from './types';

function formatQualityBadge(
  quality: ComparisonRankingProps['participants'][number]['quality']
): string | null {
  if (quality.state !== 'available' || quality.value == null || quality.threshold == null) {
    return null;
  }

  return `${quality.value} ${quality.threshold}`;
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
          {participants.map((participant) => (
            <div
              key={participant.ticketId}
              className="rounded-lg border border-border bg-background px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="font-medium text-foreground">
                    #{participant.rank} {participant.ticketKey}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {participant.title}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{participant.workflowType}</Badge>
                    {participant.agent ? (
                      <Badge variant="secondary">{participant.agent}</Badge>
                    ) : null}
                    {formatQualityBadge(participant.quality) ? (
                      <Badge variant="secondary">
                        {formatQualityBadge(participant.quality)}
                      </Badge>
                    ) : null}
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
