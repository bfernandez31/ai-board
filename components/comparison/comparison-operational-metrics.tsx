'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import type {
  ComparisonOperationalMetricValue,
  ComparisonParticipantDetail,
} from '@/lib/types/comparison';
import type { ComparisonOperationalMetricsProps } from './types';

type OperationalMetricKey =
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'durationMs'
  | 'costUsd'
  | 'jobCount';

const metricRows: Array<{ key: OperationalMetricKey; label: string }> = [
  { key: 'totalTokens', label: 'Total tokens' },
  { key: 'inputTokens', label: 'Input tokens' },
  { key: 'outputTokens', label: 'Output tokens' },
  { key: 'durationMs', label: 'Duration' },
  { key: 'costUsd', label: 'Cost' },
  { key: 'jobCount', label: 'Jobs' },
];

function getModelLabel(participant: ComparisonParticipantDetail): string {
  if (participant.operational.model.label) {
    return participant.operational.model.label;
  }

  if (participant.operational.model.state === 'pending') {
    return 'Model pending';
  }

  return 'Model unavailable';
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)} s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatOperationalValue(
  metric: ComparisonOperationalMetricValue,
  key: OperationalMetricKey
): string {
  if (metric.state === 'pending') {
    return 'Pending';
  }

  if (metric.state === 'unavailable' || metric.value == null) {
    return 'Not available';
  }

  if (metric.displayLabel) {
    return metric.displayLabel;
  }

  if (key === 'costUsd') {
    return `$${metric.value.toFixed(4)}`;
  }

  if (key === 'durationMs') {
    return formatDuration(metric.value);
  }

  return metric.value.toLocaleString();
}

function formatQualitySummary(participant: ComparisonParticipantDetail): string {
  if (participant.quality.state === 'pending') {
    return 'Pending';
  }

  if (participant.quality.state === 'unavailable' || participant.quality.score == null) {
    return 'Not available';
  }

  return participant.quality.threshold
    ? `${participant.quality.score} (${participant.quality.threshold})`
    : participant.quality.score.toString();
}

function renderValueWithBadge(label: string, isBest: boolean) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{label}</span>
      {isBest && <Badge variant="secondary">Best value</Badge>}
    </div>
  );
}

function renderQualityCell(
  participant: ComparisonParticipantDetail,
  selectedQualityTicketId: number | null,
  onQualityDetailSelect: (ticketId: number | null) => void
) {
  const label = formatQualitySummary(participant);
  const isSelected = selectedQualityTicketId === participant.ticketId;

  if (participant.quality.detailsState === 'available' && participant.quality.details) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto whitespace-normal px-2 py-1 text-left"
          aria-expanded={isSelected}
          onClick={() =>
            onQualityDetailSelect(isSelected ? null : participant.ticketId)
          }
        >
          {label}
        </Button>
        {participant.quality.isBest && <Badge variant="secondary">Best value</Badge>}
      </div>
    );
  }

  return renderValueWithBadge(label, participant.quality.isBest);
}

export function ComparisonOperationalMetrics({
  participants,
  selectedQualityTicketId,
  onQualityDetailSelect,
}: ComparisonOperationalMetricsProps) {
  const selectedQualityDetail =
    participants.find(
      (participant) =>
        participant.ticketId === selectedQualityTicketId &&
        participant.quality.detailsState === 'available' &&
        participant.quality.details
    )?.quality.details ?? null;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Operational Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <div
          className="w-full max-w-full overflow-x-auto"
          data-testid="comparison-operational-scroll"
        >
          <table className="min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border align-top">
                <th className="sticky left-0 min-w-[180px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Metric
                </th>
                {participants.map((participant) => (
                  <th
                    key={participant.ticketId}
                    className="min-w-[220px] px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    <div className="space-y-2">
                      <div className="font-semibold text-foreground">{participant.ticketKey}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{participant.workflowType}</Badge>
                        {participant.agent && (
                          <Badge variant="outline">{getAgentLabel(participant.agent)}</Badge>
                        )}
                        <Badge variant="secondary">{getModelLabel(participant)}</Badge>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 bg-card px-3 py-2 font-medium text-foreground">
                    {row.label}
                  </td>
                  {participants.map((participant) => (
                    <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                      {renderValueWithBadge(
                        formatOperationalValue(participant.operational[row.key], row.key),
                        participant.operational[row.key].isBest
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-card px-3 py-2 font-medium text-foreground">
                  Quality
                </td>
                {participants.map((participant) => (
                  <td key={participant.ticketId} className="px-3 py-2 text-foreground">
                    {renderQualityCell(
                      participant,
                      selectedQualityTicketId,
                      onQualityDetailSelect
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {selectedQualityDetail && (
          <div
            className="rounded-lg border border-border bg-background p-4"
            data-testid="comparison-quality-detail-tray"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {selectedQualityDetail.ticketKey} quality details
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Score {selectedQualityDetail.score} · {selectedQualityDetail.threshold}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onQualityDetailSelect(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {selectedQualityDetail.dimensions.map((dimension) => (
                <div
                  key={dimension.agentId}
                  className="rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="font-medium text-foreground">{dimension.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Score {dimension.score} · Weight {Math.round(dimension.weight * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ComparisonOperationalMetrics;
