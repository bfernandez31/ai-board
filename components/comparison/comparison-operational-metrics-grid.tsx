'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import type {
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
  ComparisonQualityEnrichment,
} from '@/lib/types/comparison';
import type { ComparisonSectionProps } from './types';

type NumericMetricKey =
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'durationMs'
  | 'costUsd'
  | 'jobCount';

const numericMetricRows: Array<{
  key: NumericMetricKey;
  label: string;
  bestLabel: 'Lowest';
}> = [
  { key: 'totalTokens', label: 'Total tokens', bestLabel: 'Lowest' },
  { key: 'inputTokens', label: 'Input tokens', bestLabel: 'Lowest' },
  { key: 'outputTokens', label: 'Output tokens', bestLabel: 'Lowest' },
  { key: 'durationMs', label: 'Duration', bestLabel: 'Lowest' },
  { key: 'costUsd', label: 'Cost', bestLabel: 'Lowest' },
  { key: 'jobCount', label: 'Job count', bestLabel: 'Lowest' },
];

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatCost(value: number): string {
  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(2)}`;
}

function formatMetricValue(
  key: NumericMetricKey,
  metric: ComparisonEnrichmentValue<number>
): string {
  if (metric.state === 'pending') {
    return 'pending';
  }

  if (metric.state === 'unavailable' || metric.value == null) {
    return 'N/A';
  }

  if (key === 'durationMs') {
    return formatDurationMs(metric.value);
  }

  if (key === 'costUsd') {
    return formatCost(metric.value);
  }

  return formatNumber(metric.value);
}

function formatQualityValue(quality: ComparisonQualityEnrichment): string {
  if (quality.state === 'pending') {
    return 'pending';
  }

  if (quality.state === 'unavailable' || quality.value == null || quality.threshold == null) {
    return 'N/A';
  }

  return `${quality.value} ${quality.threshold}`;
}

function formatPrimaryModel(
  primaryModel: ComparisonParticipantDetail['telemetry']['primaryModel']
): string {
  if (primaryModel.state === 'pending') {
    return 'pending';
  }

  if (primaryModel.state !== 'available' || !primaryModel.value) {
    return 'N/A';
  }

  return primaryModel.value;
}

function ParticipantHeader({
  participant,
}: {
  participant: ComparisonParticipantDetail;
}): React.JSX.Element {
  return (
    <div className="min-w-[180px] space-y-1">
      <div className="font-medium text-foreground">{participant.ticketKey}</div>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{participant.workflowType}</Badge>
        {participant.agent ? <Badge variant="secondary">{participant.agent}</Badge> : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatPrimaryModel(participant.telemetry.primaryModel)}
      </div>
    </div>
  );
}

function MetricCell({
  value,
  isBest,
}: {
  value: string;
  isBest: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <span>{value}</span>
      {isBest ? <Badge variant="secondary">Best value</Badge> : null}
    </div>
  );
}

function QualityPopover({
  participant,
}: {
  participant: ComparisonParticipantDetail;
}): React.JSX.Element {
  const { quality } = participant;

  if (
    quality.state !== 'available' ||
    quality.value == null ||
    quality.threshold == null ||
    quality.details == null
  ) {
    return <span>{formatQualityValue(quality)}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-border px-2 py-1 text-left text-foreground hover:bg-secondary"
          aria-label={`View quality breakdown for ${participant.ticketKey}`}
        >
          {formatQualityValue(quality)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">Quality breakdown</div>
          <div className="text-sm text-muted-foreground">{participant.ticketKey}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="font-medium text-foreground">
            {quality.value} {quality.threshold}
          </div>
        </div>
        <div className="space-y-3">
          {quality.details.dimensions.map((dimension) => (
            <div key={dimension.agentId} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{dimension.name}</span>
                <span className="text-muted-foreground">
                  {dimension.score} · {Math.round(dimension.weight * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(dimension.score, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ComparisonOperationalMetricsGrid({
  participants,
}: ComparisonSectionProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 min-w-[180px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((participant) => (
                <th
                  key={participant.ticketId}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  <ParticipantHeader participant={participant} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numericMetricRows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-3 font-medium text-foreground">
                  <div>{row.label}</div>
                  <div className="text-xs text-muted-foreground">Best = {row.bestLabel}</div>
                </td>
                {participants.map((participant) => (
                  <td key={participant.ticketId} className="px-3 py-3 text-foreground">
                    <MetricCell
                      value={formatMetricValue(row.key, participant.telemetry[row.key])}
                      isBest={participant.telemetry.bestValueFlags[row.key] === true}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-border last:border-0">
              <td className="sticky left-0 z-10 bg-card px-3 py-3 font-medium text-foreground">
                <div>Quality</div>
                <div className="text-xs text-muted-foreground">Best = Highest</div>
              </td>
              {participants.map((participant) => (
                <td key={participant.ticketId} className="px-3 py-3 text-foreground">
                  <div className="flex min-w-[140px] items-center gap-2">
                    <QualityPopover participant={participant} />
                    {participant.telemetry.bestValueFlags.quality === true ? (
                      <Badge variant="secondary">Best value</Badge>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default ComparisonOperationalMetricsGrid;
