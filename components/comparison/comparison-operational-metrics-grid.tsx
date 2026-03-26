'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getScoreColor } from '@/lib/quality-score';
import type {
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';

type MetricValue = number | string;

const metricRows = [
  {
    key: 'totalTokens',
    label: 'Total tokens',
    description: 'Total tokens consumed (input + output)',
    best: 'lowest',
  },
  {
    key: 'inputTokens',
    label: 'Input tokens',
    description: 'Input tokens',
    best: 'lowest',
  },
  {
    key: 'outputTokens',
    label: 'Output tokens',
    description: 'Output tokens',
    best: 'lowest',
  },
  {
    key: 'durationMs',
    label: 'Duration',
    description: 'Total execution time',
    best: 'lowest',
  },
  {
    key: 'costUsd',
    label: 'Cost',
    description: 'Total cost in USD',
    best: 'lowest',
  },
  {
    key: 'jobCount',
    label: 'Job count',
    description: 'Number of jobs executed for this ticket',
    best: 'lowest',
  },
  {
    key: 'quality',
    label: 'Quality',
    description: 'Quality gate score',
    best: 'highest',
  },
] as const;

function formatMetricValue(
  metricKey: (typeof metricRows)[number]['key'],
  value: MetricValue | null
): string {
  if (value == null) {
    return 'N/A';
  }

  if (metricKey === 'costUsd' && typeof value === 'number') {
    return `$${value.toFixed(4)}`;
  }

  if (metricKey === 'durationMs' && typeof value === 'number') {
    return formatDurationMs(value);
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value;
}

function renderEnrichmentValue<T>(
  value: ComparisonEnrichmentValue<T>,
  renderedValue: string
): string {
  if (value.state === 'pending') {
    return 'pending';
  }

  if (value.state === 'unavailable') {
    return 'N/A';
  }

  return renderedValue;
}

function getBestValueTicketIds(
  participants: ComparisonParticipantDetail[],
  metricKey: (typeof metricRows)[number]['key']
): Set<number> {
  const values = participants.flatMap((participant) => {
    const enrichment =
      metricKey === 'quality' ? participant.quality : participant.telemetry[metricKey];

    return enrichment.state === 'available' && enrichment.value != null
      ? [{ ticketId: participant.ticketId, value: enrichment.value as number }]
      : [];
  });

  if (values.length === 0) {
    return new Set<number>();
  }

  const bestValue =
    metricRows.find((row) => row.key === metricKey)?.best === 'highest'
      ? Math.max(...values.map((entry) => entry.value))
      : Math.min(...values.map((entry) => entry.value));

  return new Set(
    values
      .filter((entry) => entry.value === bestValue)
      .map((entry) => entry.ticketId)
  );
}

function QualityBreakdownPopover({
  participant,
}: {
  participant: ComparisonParticipantDetail;
}): React.JSX.Element {
  const qualityDetails = participant.qualityDetails.value;
  const qualityValue = participant.quality.value;

  if (
    participant.qualityDetails.state !== 'available' ||
    !qualityDetails ||
    qualityValue == null
  ) {
    return <span>{renderEnrichmentValue(participant.quality, formatMetricValue('quality', qualityValue))}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-left text-foreground hover:bg-secondary"
          aria-label={`View quality breakdown for ${participant.ticketKey}`}
        >
          <span>{qualityValue}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">Quality Breakdown</div>
          <div className="text-xs text-muted-foreground">
            {participant.ticketKey} · {qualityValue} {qualityDetails.threshold}
          </div>
        </div>
        <div className="space-y-3">
          {qualityDetails.dimensions.map((dimension) => {
            const colors = getScoreColor(dimension.score);

            return (
              <div key={dimension.agentId} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{dimension.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(dimension.weight * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${colors.fill}`}
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                  <span className={colors.text}>{dimension.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ComparisonOperationalMetricsGrid({
  participants,
}: {
  participants: ComparisonParticipantDetail[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 min-w-[220px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((participant) => (
                <th
                  key={participant.ticketId}
                  className="min-w-[190px] px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  <div className="font-semibold text-foreground">{participant.ticketKey}</div>
                  <div className="text-xs text-muted-foreground">
                    {participant.workflowType}
                    {participant.agent ? ` · ${participant.agent}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {renderEnrichmentValue(
                      participant.telemetry.model,
                      participant.telemetry.model.value ?? 'N/A'
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => {
              const bestTicketIds = getBestValueTicketIds(participants, row.key);

              return (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-3 align-top">
                    <div className="font-medium text-foreground">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.description}</div>
                    <div className="text-xs text-muted-foreground">
                      Best = {row.best === 'highest' ? 'Highest' : 'Lowest'}
                    </div>
                  </td>
                  {participants.map((participant) => {
                    const enrichment =
                      row.key === 'quality'
                        ? participant.quality
                        : participant.telemetry[row.key];
                    const displayValue =
                      row.key === 'quality'
                        ? formatMetricValue(row.key, participant.quality.value)
                        : formatMetricValue(row.key, participant.telemetry[row.key].value);

                    return (
                      <td key={participant.ticketId} className="px-3 py-3 align-top text-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.key === 'quality' ? (
                            <QualityBreakdownPopover participant={participant} />
                          ) : (
                            <span>{renderEnrichmentValue(enrichment, displayValue)}</span>
                          )}
                          {bestTicketIds.has(participant.ticketId) && enrichment.state === 'available' && (
                            <Badge variant="secondary">Best value</Badge>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
