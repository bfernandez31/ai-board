'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import {
  DIMENSION_CONFIG,
  getScoreColor,
  getScoreThreshold,
  parseQualityScoreDetails,
} from '@/lib/quality-score';
import type {
  ComparisonEnrichmentValue,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';
import type { ComparisonSectionProps } from './types';

interface MetricRowConfig {
  key: string;
  label: string;
  bestDirection: 'lowest' | 'highest';
  getValue: (p: ComparisonParticipantDetail) => ComparisonEnrichmentValue<number>;
  format: (value: number) => string;
}

const metricRows: MetricRowConfig[] = [
  {
    key: 'totalTokens',
    label: 'Total tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.totalTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'inputTokens',
    label: 'Input tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.inputTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'outputTokens',
    label: 'Output tokens',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.outputTokens,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'duration',
    label: 'Duration',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.durationMs,
    format: (v) => formatDurationMs(v),
  },
  {
    key: 'cost',
    label: 'Cost',
    bestDirection: 'lowest',
    getValue: (p) => p.telemetry.costUsd,
    format: (v) => (v > 0 ? `$${v.toFixed(4)}` : 'N/A'),
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
    format: (v) => `${v}`,
  },
];

function computeBestValues(
  participants: ComparisonParticipantDetail[],
  row: MetricRowConfig
): Set<number> {
  const availableValues = participants
    .map((p) => {
      const enrichment = row.getValue(p);
      return { ticketId: p.ticketId, value: enrichment.state === 'available' ? enrichment.value : null };
    })
    .filter((v): v is { ticketId: number; value: number } => v.value != null);

  if (availableValues.length < 2) return new Set();

  const bestValue =
    row.bestDirection === 'lowest'
      ? Math.min(...availableValues.map((v) => v.value))
      : Math.max(...availableValues.map((v) => v.value));

  return new Set(
    availableValues.filter((v) => v.value === bestValue).map((v) => v.ticketId)
  );
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
    return <span className="text-muted-foreground italic">Pending</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span>{format(enrichment.value!)}</span>
      {isBest && <Badge variant="secondary">Best value</Badge>}
    </div>
  );
}

function QualityScoreCell({
  participant,
  isBest,
}: {
  participant: ComparisonParticipantDetail;
  isBest: boolean;
}) {
  const { quality } = participant;

  if (quality.state === 'unavailable') {
    return <span className="text-muted-foreground">N/A</span>;
  }

  if (quality.state === 'pending') {
    return <span className="text-muted-foreground italic">Pending</span>;
  }

  const score = quality.value!;
  const details = parseQualityScoreDetails(participant.qualityScoreDetails);
  const colors = getScoreColor(score);
  const threshold = getScoreThreshold(score);

  if (!details) {
    return (
      <div className="flex items-center gap-2">
        <span className={colors.text}>{score} {threshold}</span>
        {isBest && <Badge variant="secondary">Best value</Badge>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${colors.text} cursor-pointer underline decoration-dotted underline-offset-4 hover:opacity-80`}
          >
            {score} {threshold}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <QualityBreakdown score={score} details={details} />
        </PopoverContent>
      </Popover>
      {isBest && <Badge variant="secondary">Best value</Badge>}
    </div>
  );
}

function QualityBreakdown({
  score,
  details,
}: {
  score: number;
  details: NonNullable<ReturnType<typeof parseQualityScoreDetails>>;
}) {
  const colors = getScoreColor(score);
  const threshold = getScoreThreshold(score);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Quality Breakdown</span>
        <span className={`text-sm font-semibold ${colors.text}`}>
          {score} {threshold}
        </span>
      </div>
      <div className="space-y-2">
        {DIMENSION_CONFIG.map((dim) => {
          const dimScore = details.dimensions.find((d) => d.agentId === dim.agentId);
          if (!dimScore) return null;
          const dimColors = getScoreColor(dimScore.score);
          return (
            <div key={dim.agentId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {dim.name}
                  <span className="ml-1 text-muted-foreground">
                    ({dim.weight > 0 ? `${Math.round(dim.weight * 100)}%` : 'info'})
                  </span>
                </span>
                <span className={dimColors.text}>{dimScore.score}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full ${dimColors.fill}`}
                  style={{ width: `${dimScore.score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelCell({ participant }: { participant: ComparisonParticipantDetail }) {
  const { model } = participant.telemetry;
  if (model.state === 'unavailable') {
    return <span className="text-muted-foreground">N/A</span>;
  }
  if (model.state === 'pending') {
    return <span className="text-muted-foreground italic">Pending</span>;
  }
  return <span>{model.value}</span>;
}

export function ComparisonOperationalGrid({ participants }: ComparisonSectionProps) {
  const bestValueSets = metricRows.map((row) => computeBestValues(participants, row));

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
              {participants.map((p) => (
                <th
                  key={p.ticketId}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  <div>{p.ticketKey}</div>
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {p.workflowType}
                    </Badge>
                    {p.agent && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {p.agent}
                      </Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row, rowIndex) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                  {row.label}
                </td>
                {participants.map((p) => {
                  const isBest = bestValueSets[rowIndex]?.has(p.ticketId) ?? false;

                  if (row.key === 'quality') {
                    return (
                      <td key={p.ticketId} className="px-3 py-2 text-foreground">
                        <QualityScoreCell participant={p} isBest={isBest} />
                      </td>
                    );
                  }

                  return (
                    <td key={p.ticketId} className="px-3 py-2 text-foreground">
                      <EnrichmentCell
                        enrichment={row.getValue(p)}
                        format={row.format}
                        isBest={isBest}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b border-border last:border-0">
              <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                Model
              </td>
              {participants.map((p) => (
                <td key={p.ticketId} className="px-3 py-2 text-foreground">
                  <ModelCell participant={p} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
