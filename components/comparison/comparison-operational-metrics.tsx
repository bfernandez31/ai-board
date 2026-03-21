'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScoreThreshold } from '@/lib/quality-score';
import type {
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';
import type { ComparisonOperationalMetricsProps } from './types';

type MetricKey =
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'durationMs'
  | 'costUsd'
  | 'jobCount'
  | 'quality';

interface MetricConfig {
  key: MetricKey;
  label: string;
  bestDirection: 'lowest' | 'highest';
  format: (value: number) => string;
}

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

const METRICS: MetricConfig[] = [
  { key: 'totalTokens', label: 'Total Tokens', bestDirection: 'lowest', format: (v) => compactNumber.format(v) },
  { key: 'inputTokens', label: 'Input Tokens', bestDirection: 'lowest', format: (v) => compactNumber.format(v) },
  { key: 'outputTokens', label: 'Output Tokens', bestDirection: 'lowest', format: (v) => compactNumber.format(v) },
  { key: 'durationMs', label: 'Duration', bestDirection: 'lowest', format: formatDuration },
  { key: 'costUsd', label: 'Cost', bestDirection: 'lowest', format: (v) => `$${v.toFixed(2)}` },
  { key: 'jobCount', label: 'Job Count', bestDirection: 'lowest', format: (v) => String(v) },
  { key: 'quality', label: 'Quality', bestDirection: 'highest', format: (v) => `${v} ${getScoreThreshold(v)}` },
];

function getEnrichmentValue(
  participant: ComparisonParticipantDetail,
  key: MetricKey
): ComparisonEnrichmentValue<number> {
  if (key === 'quality') return participant.quality;
  return participant.telemetry[key];
}

function computeBestValues(
  participants: ComparisonParticipantDetail[],
  metric: MetricConfig
): Set<number> {
  const available = participants
    .map((p) => {
      const ev = getEnrichmentValue(p, metric.key);
      return ev.state === 'available' && ev.value != null
        ? { ticketId: p.ticketId, value: ev.value }
        : null;
    })
    .filter((x): x is { ticketId: number; value: number } => x != null);

  if (available.length < 2) return new Set();

  const bestValue =
    metric.bestDirection === 'lowest'
      ? Math.min(...available.map((a) => a.value))
      : Math.max(...available.map((a) => a.value));

  return new Set(
    available.filter((a) => a.value === bestValue).map((a) => a.ticketId)
  );
}

function renderValue(
  enrichment: ComparisonEnrichmentValue<number>,
  format: (value: number) => string,
  isBest: boolean
) {
  if (enrichment.state === 'pending') {
    return <span className="text-muted-foreground">Pending</span>;
  }
  if (enrichment.state === 'unavailable' || enrichment.value == null) {
    return <span className="text-muted-foreground">N/A</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span>{format(enrichment.value)}</span>
      {isBest && (
        <Badge variant="outline" className="text-ctp-green text-xs px-1 py-0">
          Best
        </Badge>
      )}
    </span>
  );
}

export function ComparisonOperationalMetrics({
  participants,
}: ComparisonOperationalMetricsProps) {
  const bestSets = METRICS.map((metric) => computeBestValues(participants, metric));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Metric
                </th>
                {participants.map((p) => (
                  <th key={p.ticketId} className="px-3 py-2 text-left font-medium">
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground">{p.ticketKey}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {p.workflowType}
                        </Badge>
                        {p.agent != null && (
                          <Badge variant="secondary" className="text-xs">
                            {p.agent}
                          </Badge>
                        )}
                      </div>
                      {p.model != null && (
                        <span className="text-xs text-muted-foreground">{p.model}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric, metricIndex) => (
                <tr key={metric.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                    {metric.label}
                  </td>
                  {participants.map((p) => {
                    const enrichment = getEnrichmentValue(p, metric.key);
                    const isBest = bestSets[metricIndex]?.has(p.ticketId) ?? false;
                    return (
                      <td key={p.ticketId} className="px-3 py-2">
                        {renderValue(enrichment, metric.format, isBest)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
