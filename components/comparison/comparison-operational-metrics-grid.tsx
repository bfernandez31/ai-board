'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScoreColor } from '@/lib/quality-score';
import type { ComparisonOperationalMetricsGridProps } from './types';

const operationalRows = [
  { key: 'totalTokens', label: 'Total tokens', bestCopy: 'Lowest total' },
  { key: 'inputTokens', label: 'Input tokens', bestCopy: 'Lowest input' },
  { key: 'outputTokens', label: 'Output tokens', bestCopy: 'Lowest output' },
  { key: 'durationMs', label: 'Duration', bestCopy: 'Fastest' },
  { key: 'costUsd', label: 'Cost', bestCopy: 'Lowest cost' },
  { key: 'jobCount', label: 'Jobs', bestCopy: 'Fewest jobs' },
] as const;

function formatEnrichmentValue(
  key: typeof operationalRows[number]['key'],
  value: number
): string {
  if (key === 'costUsd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }

  if (key === 'durationMs') {
    if (value < 1000) {
      return `${value} ms`;
    }

    const seconds = value / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
    }

    return `${(seconds / 60).toFixed(1)} min`;
  }

  return value.toLocaleString();
}

function formatQualityValue(participant: ComparisonOperationalMetricsGridProps['participants'][number]) {
  if (participant.quality.score.state === 'pending') {
    return 'Pending';
  }

  if (participant.quality.score.state === 'unavailable' || participant.quality.score.value == null) {
    return 'N/A';
  }

  return `${participant.quality.score.value} / 100`;
}

function formatOperationalValue(
  participant: ComparisonOperationalMetricsGridProps['participants'][number],
  key: typeof operationalRows[number]['key']
): string {
  const metric = participant.operational[key];

  if (metric.state === 'pending') {
    return 'Pending';
  }

  if (metric.state === 'unavailable' || metric.value == null) {
    return 'N/A';
  }

  return formatEnrichmentValue(key, metric.value);
}

export function ComparisonOperationalMetricsGrid({
  participants,
}: ComparisonOperationalMetricsGridProps) {
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" data-testid="comparison-operational-scroll">
          <table className="min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-20 min-w-48 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Metric
                </th>
                {participants.map((participant) => (
                  <th
                    key={participant.ticketId}
                    className="min-w-56 px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">{participant.ticketKey}</div>
                      <div className="text-xs text-muted-foreground">{participant.workflowType}</div>
                      <div className="text-xs text-muted-foreground">
                        {participant.operational.primaryModel ?? 'Model N/A'}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operationalRows.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-3 font-medium text-foreground">
                    {row.label}
                  </td>
                  {participants.map((participant) => {
                    const isBest = participant.operational.bestValueFlags[row.key];

                    return (
                      <td key={participant.ticketId} className="px-3 py-3 align-top text-foreground">
                        <div className="space-y-2">
                          <div>{formatOperationalValue(participant, row.key)}</div>
                          {isBest && <Badge variant="secondary">{row.bestCopy}</Badge>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-3 font-medium text-foreground">
                  Quality
                </td>
                {participants.map((participant) => {
                  const isExpanded = expandedTicketId === participant.ticketId;
                  const hasBreakdown =
                    participant.quality.detailAvailable && participant.quality.breakdown != null;
                  const scoreValue = participant.quality.score.value;
                  const scoreColor =
                    typeof scoreValue === 'number'
                      ? getScoreColor(scoreValue).text
                      : 'text-foreground';

                  return (
                    <td key={participant.ticketId} className="px-3 py-3 align-top text-foreground">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={scoreColor}>{formatQualityValue(participant)}</span>
                          {participant.quality.thresholdLabel && (
                            <Badge variant="outline">{participant.quality.thresholdLabel}</Badge>
                          )}
                          {participant.quality.isBestValue && (
                            <Badge variant="secondary">Highest quality</Badge>
                          )}
                        </div>
                        {hasBreakdown ? (
                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto px-0 text-xs text-muted-foreground"
                              onClick={() =>
                                setExpandedTicketId((current) =>
                                  current === participant.ticketId ? null : participant.ticketId
                                )
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="mr-1 h-3.5 w-3.5" />
                              )}
                              View breakdown
                            </Button>
                            {isExpanded && participant.quality.breakdown && (
                              <div
                                className="rounded-md border border-border bg-muted/30 p-3"
                                data-testid={`quality-breakdown-${participant.ticketId}`}
                              >
                                <div className="mb-2 text-xs font-medium text-muted-foreground">
                                  Overall {participant.quality.breakdown.overallScore} ·{' '}
                                  {participant.quality.breakdown.thresholdLabel}
                                </div>
                                <div className="space-y-2">
                                  {participant.quality.breakdown.dimensions.map((dimension) => (
                                    <div
                                      key={dimension.agentId}
                                      className="flex items-center justify-between gap-3 text-xs"
                                      data-testid={`quality-dimension-${participant.ticketId}-${dimension.agentId}`}
                                    >
                                      <span className="text-foreground">
                                        {dimension.name} ({Math.round(dimension.weight * 100)}%)
                                      </span>
                                      <span className="font-medium text-foreground">
                                        {dimension.score}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Details unavailable</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
