'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComparisonDashboardMetricRow } from '@/lib/types/comparison';
import type { ComparisonRankingProps } from './types';

function formatGeneratedAt(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getScoreBandClasses(scoreBand: string) {
  switch (scoreBand) {
    case 'strong':
      return 'border-primary/30 bg-primary/10';
    case 'moderate':
      return 'border-accent bg-accent/60';
    case 'weak':
      return 'border-destructive/20 bg-destructive/10';
    default:
      return 'border-border bg-muted/60';
  }
}

function getHeadlineMetricCell(
  row: ComparisonDashboardMetricRow,
  winnerTicketId: number
) {
  return row.cells.find((cell) => cell.ticketId === winnerTicketId) ?? row.cells[0] ?? null;
}

export function ComparisonRanking({
  participants,
  recommendation,
  summary,
  winnerTicketId,
  keyDifferentiators,
  generatedAt,
  sourceTicketKey,
  winnerTicketKey,
  headlineMetrics,
}: ComparisonRankingProps) {
  const winner = participants.find((participant) => participant.ticketId === winnerTicketId);
  const nonWinners = participants.filter((participant) => participant.ticketId !== winnerTicketId);

  if (!winner) {
    return null;
  }

  return (
    <section className="space-y-4" aria-label="Mission control ranking">
      <Card className="overflow-hidden border-primary/20 bg-card">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Winner</Badge>
                <Badge variant="outline">#{winner.rank}</Badge>
                <Badge variant="outline">{winner.ticketKey}</Badge>
                <Badge variant="outline">{winner.score}%</Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {recommendation}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
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
            </div>

            <div className="grid min-w-[240px] gap-2 rounded-xl border border-border bg-background/80 p-4 text-sm">
              <div className="font-medium text-foreground">Comparison context</div>
              <div className="text-muted-foreground">Generated {formatGeneratedAt(generatedAt)}</div>
              <div className="text-muted-foreground">Source {sourceTicketKey}</div>
              <div className="text-muted-foreground">Selected winner {winnerTicketKey}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {headlineMetrics.map((row) => {
              const cell = getHeadlineMetricCell(row, winnerTicketId);

              return (
                <div
                  key={row.key}
                  className="rounded-xl border border-border bg-background/80 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {row.label}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-foreground">
                    {cell?.displayValue ?? 'Unavailable'}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {cell?.isBest ? 'Best value in this comparison' : 'Relative summary metric'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {nonWinners.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {nonWinners.map((participant) => (
            <Card
              key={participant.ticketId}
              className={cn(
                'border-border bg-card',
                getScoreBandClasses(participant.scoreBand)
              )}
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{participant.rank}</Badge>
                      <span className="font-semibold text-foreground">
                        {participant.ticketKey}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">{participant.title}</div>
                  </div>
                  <Badge variant="outline">{participant.score}%</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{participant.workflowType}</Badge>
                  {participant.agent ? <Badge variant="outline">{participant.agent}</Badge> : null}
                  <Badge variant="secondary">{participant.scoreBand}</Badge>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {participant.rankRationale}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
