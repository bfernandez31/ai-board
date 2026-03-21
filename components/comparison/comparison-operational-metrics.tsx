'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import { ComparisonQualityPopover } from './comparison-quality-popover';
import type { ComparisonSectionProps } from './types';

type MetricRowConfig = {
  key: string;
  label: string;
  bestDirection: 'lowest' | 'highest';
  getValue: (p: ComparisonParticipantDetail) => ComparisonEnrichmentValue<number>;
  format: (value: number) => string;
};

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms >= 3_600_000) {
    const hours = ms / 3_600_000;
    return `${hours.toFixed(1)}h`;
  }
  if (ms >= 60_000) {
    const minutes = ms / 60_000;
    return `${minutes.toFixed(1)}m`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

const metricRows: MetricRowConfig[] = [
  {
    key: 'totalTokens',
    label: 'Total tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.totalTokens,
    format: formatTokens,
  },
  {
    key: 'inputTokens',
    label: 'Input tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.inputTokens,
    format: formatTokens,
  },
  {
    key: 'outputTokens',
    label: 'Output tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.outputTokens,
    format: formatTokens,
  },
  {
    key: 'duration',
    label: 'Duration',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.durationMs,
    format: formatDuration,
  },
  {
    key: 'cost',
    label: 'Cost',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.costUsd,
    format: formatCost,
  },
  {
    key: 'jobCount',
    label: 'Job count',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.jobCount,
    format: (v) => v.toString(),
  },
  {
    key: 'quality',
    label: 'Quality',
    bestDirection: 'highest',
    getValue: (p) => p.quality,
    format: (v) => v.toString(),
  },
];

function computeBestValues(
  participants: ComparisonParticipantDetail[],
  rows: MetricRowConfig[]
): Record<string, number | null> {
  const best: Record<string, number | null> = {};
  for (const row of rows) {
    const availableValues = participants
      .map((p) => row.getValue(p))
      .filter((v) => v.state === 'available' && v.value != null)
      .map((v) => v.value!);

    if (availableValues.length === 0) {
      best[row.key] = null;
      continue;
    }
    best[row.key] =
      row.bestDirection === 'lowest'
        ? Math.min(...availableValues)
        : Math.max(...availableValues);
  }
  return best;
}

function EnrichmentCell({
  enrichment,
  format,
  isBest,
}: {
  enrichment: ComparisonEnrichmentValue<number>;
  format: (v: number) => string;
  isBest: boolean;
}) {
  if (enrichment.state === 'unavailable') {
    return <span className="text-muted-foreground">N/A</span>;
  }
  if (enrichment.state === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Pending
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span>{format(enrichment.value!)}</span>
      {isBest && <Badge variant="secondary">Best value</Badge>}
    </div>
  );
}

export function ComparisonOperationalMetrics({ participants }: ComparisonSectionProps) {
  const bestValues = computeBestValues(participants, metricRows);

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
                  <div>{participant.ticketKey}</div>
                  <div className="flex items-center gap-1 text-xs font-normal">
                    <span>{participant.workflowType}</span>
                    {participant.agent && (
                      <>
                        <span className="text-muted-foreground/40">/</span>
                        <span>{participant.agent}</span>
                      </>
                    )}
                    {participant.telemetry.model.state === 'available' && (
                      <>
                        <span className="text-muted-foreground/40">/</span>
                        <span>{participant.telemetry.model.value}</span>
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                  {row.label}
                </td>
                {participants.map((participant) => {
                  const enrichment = row.getValue(participant);
                  const isBest =
                    enrichment.state === 'available' &&
                    enrichment.value != null &&
                    bestValues[row.key] != null &&
                    enrichment.value === bestValues[row.key];

                  if (row.key === 'quality' && enrichment.state === 'available' && enrichment.value != null) {
                    const score = enrichment.value;
                    const scoreColor = getScoreColor(score);
                    const scoreLabel = getScoreThreshold(score);
                    const details = participant.qualityDetails;

                    const content = (
                      <div className="flex items-center gap-2">
                        <span className={scoreColor.text}>{score} {scoreLabel}</span>
                        {isBest && <Badge variant="secondary">Best value</Badge>}
                      </div>
                    );

                    if (details.state === 'available' && details.value) {
                      return (
                        <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                          <ComparisonQualityPopover score={score} details={details.value}>
                            <button type="button" className="cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:decoration-solid">
                              {content}
                            </button>
                          </ComparisonQualityPopover>
                        </td>
                      );
                    }

                    return (
                      <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                        {content}
                      </td>
                    );
                  }

                  return (
                    <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                      <EnrichmentCell
                        enrichment={enrichment}
                        format={row.format}
                        isBest={isBest}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
