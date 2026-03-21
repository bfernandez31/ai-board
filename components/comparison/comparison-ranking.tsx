'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { ComparisonRankingProps } from './types';

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
                <div>
                  <div className="font-medium text-foreground">
                    #{participant.rank} {participant.ticketKey}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {participant.title}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{participant.workflowType}</Badge>
                  {participant.agent != null && (
                    <Badge variant="secondary">{participant.agent}</Badge>
                  )}
                  {participant.quality.state === 'available' &&
                    participant.quality.value != null && (
                      <Badge
                        data-testid={`quality-badge-${participant.ticketId}`}
                        className={getScoreColor(participant.quality.value).text}
                        variant="outline"
                      >
                        {participant.quality.value} {getScoreThreshold(participant.quality.value)}
                      </Badge>
                    )}
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
