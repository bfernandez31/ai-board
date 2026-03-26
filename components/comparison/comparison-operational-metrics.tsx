'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { QualityScorePopover } from './comparison-quality-popover';
import type { ComparisonSectionProps } from './types';

type MetricRowConfig = {
  key: string;
  label: string;
  bestIs: 'lowest' | 'highest';
  getValue: (p: ComparisonParticipantDetail) => ComparisonEnrichmentValue<number>;
  format: (value: number) => string;
};

const metricRows: MetricRowConfig[] = [
  {
    key: 'totalTokens',
    label: 'Total tokens',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.totalTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'inputTokens',
    label: 'Input tokens',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.inputTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'outputTokens',
    label: 'Output tokens',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.outputTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'durationMs',
    label: 'Duration',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.durationMs,
    format: (v) => formatDurationMs(v),
  },
  {
    key: 'costUsd',
    label: 'Cost',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.costUsd,
    format: (v) => (v > 0 ? `$${v.toFixed(4)}` : '$0.00'),
  },
  {
    key: 'jobCount',
    label: 'Job count',
    bestIs: 'lowest',
    getValue: (p) => p.telemetry.jobCount,
    format: (v) => v.toString(),
  },
];

function findBestIndex(
  participants: ComparisonParticipantDetail[],
  getValue: (p: ComparisonParticipantDetail) => ComparisonEnrichmentValue<number>,
  bestIs: 'lowest' | 'highest'
): number {
  let bestIdx = -1;
  let bestVal: number | null = null;
  let availableCount = 0;

  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    if (!participant) continue;
    const enrichment = getValue(participant);
    if (enrichment.state !== 'available' || enrichment.value == null) continue;
    availableCount++;
    if (
      bestVal == null ||
      (bestIs === 'lowest' && enrichment.value < bestVal) ||
      (bestIs === 'highest' && enrichment.value > bestVal)
    ) {
      bestVal = enrichment.value;
      bestIdx = i;
    }
  }

  return availableCount >= 2 ? bestIdx : -1;
}

function renderEnrichmentCell(
  enrichment: ComparisonEnrichmentValue<number>,
  format: (v: number) => string,
  isBest: boolean
) {
  if (enrichment.state === 'pending') {
    return <span className="text-sm text-muted-foreground">Pending</span>;
  }
  if (enrichment.state === 'unavailable' || enrichment.value == null) {
    return <span className="text-sm text-muted-foreground">N/A</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-foreground">{format(enrichment.value)}</span>
      {isBest && <Badge variant="secondary">Best value</Badge>}
    </div>
  );
}

export function ComparisonOperationalMetrics({
  participants,
}: ComparisonSectionProps) {
  const bestQualityIdx = findBestIndex(
    participants,
    (p) => p.quality,
    'highest'
  );

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
                        <span className="text-muted-foreground">/</span>
                        <span>{participant.agent}</span>
                      </>
                    )}
                    {participant.telemetry.model.state === 'available' &&
                      participant.telemetry.model.value && (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <span>{participant.telemetry.model.value}</span>
                        </>
                      )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => {
              const bestIdx = findBestIndex(
                participants,
                row.getValue,
                row.bestIs
              );

              return (
                <tr
                  key={row.key}
                  className="border-b border-border last:border-0"
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {row.label}
                  </td>
                  {participants.map((participant, idx) => (
                    <td key={participant.ticketId} className="px-3 py-2">
                      {renderEnrichmentCell(
                        row.getValue(participant),
                        row.format,
                        idx === bestIdx
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="border-b border-border last:border-0">
              <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                Quality
              </td>
              {participants.map((participant, idx) => (
                <td key={participant.ticketId} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <QualityScorePopover
                      quality={participant.quality}
                      qualityDetails={participant.qualityDetails}
                    />
                    {idx === bestQualityIdx && (
                      <Badge variant="secondary">Best value</Badge>
                    )}
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
