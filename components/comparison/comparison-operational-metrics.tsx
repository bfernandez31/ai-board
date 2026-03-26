'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { getScoreThreshold } from '@/lib/quality-score';
import type { OperationalMetricsProps } from './types';

type MetricKey =
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'durationMs'
  | 'costUsd'
  | 'jobCount'
  | 'qualityScore';

interface MetricRowConfig {
  key: MetricKey;
  label: string;
  format: (value: number) => string;
  bestIs: 'lowest' | 'highest';
}

const metricRows: MetricRowConfig[] = [
  {
    key: 'totalTokens',
    label: 'Total Tokens',
    format: (v) => v.toLocaleString(),
    bestIs: 'lowest',
  },
  {
    key: 'inputTokens',
    label: 'Input Tokens',
    format: (v) => v.toLocaleString(),
    bestIs: 'lowest',
  },
  {
    key: 'outputTokens',
    label: 'Output Tokens',
    format: (v) => v.toLocaleString(),
    bestIs: 'lowest',
  },
  {
    key: 'durationMs',
    label: 'Duration',
    format: formatDuration,
    bestIs: 'lowest',
  },
  {
    key: 'costUsd',
    label: 'Cost',
    format: (v) => `$${v.toFixed(2)}`,
    bestIs: 'lowest',
  },
  {
    key: 'jobCount',
    label: 'Job Count',
    format: (v) => v.toLocaleString(),
    bestIs: 'lowest',
  },
  {
    key: 'qualityScore',
    label: 'Quality Score',
    format: formatQualityScore,
    bestIs: 'highest',
  },
];

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatQualityScore(score: number): string {
  return `${score} ${getScoreThreshold(score)}`;
}

function getEnrichmentValue(
  participant: ComparisonParticipantDetail,
  key: MetricKey
): ComparisonEnrichmentValue<number> {
  if (key === 'qualityScore') {
    return participant.quality;
  }
  return participant.telemetry[key as keyof typeof participant.telemetry] as ComparisonEnrichmentValue<number>;
}

function computeBestValues(
  participants: ComparisonParticipantDetail[],
  key: MetricKey,
  bestIs: 'lowest' | 'highest'
): Set<number> {
  const available = participants
    .map((p) => ({ ticketId: p.ticketId, enrichment: getEnrichmentValue(p, key) }))
    .filter((entry) => entry.enrichment.state === 'available' && entry.enrichment.value != null);

  if (available.length === 0) return new Set();

  const values = available.map((entry) => entry.enrichment.value!);
  const bestValue = bestIs === 'lowest' ? Math.min(...values) : Math.max(...values);

  return new Set(
    available
      .filter((entry) => entry.enrichment.value === bestValue)
      .map((entry) => entry.ticketId)
  );
}

function getColumnHeader(participant: ComparisonParticipantDetail): string {
  const parts = [participant.ticketKey, participant.workflowType];
  if (participant.agent) {
    parts.push(participant.agent);
  }
  return parts.join(' · ');
}

export function ComparisonOperationalMetrics({ participants }: OperationalMetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((participant) => (
                <th
                  key={participant.ticketId}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {getColumnHeader(participant)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => {
              const bestTicketIds = computeBestValues(participants, row.key, row.bestIs);

              return (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {row.label}
                  </td>
                  {participants.map((participant) => {
                    const enrichment = getEnrichmentValue(participant, row.key);
                    const isBest = bestTicketIds.has(participant.ticketId);

                    return (
                      <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          <CellValue
                            enrichment={enrichment}
                            format={row.format}
                            metricKey={row.key}
                            participant={participant}
                          />
                          {isBest && <Badge variant="secondary">Best</Badge>}
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

function CellValue({
  enrichment,
  format,
  metricKey: _metricKey,
  participant: _participant,
}: {
  enrichment: ComparisonEnrichmentValue<number>;
  format: (value: number) => string;
  metricKey: MetricKey;
  participant: ComparisonParticipantDetail;
}) {
  if (enrichment.state === 'unavailable') {
    return <span className="text-muted-foreground">N/A</span>;
  }
  if (enrichment.state === 'pending') {
    return <span className="text-muted-foreground">Pending</span>;
  }
  return <span>{format(enrichment.value!)}</span>;
}
