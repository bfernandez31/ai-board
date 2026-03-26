'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { getScoreThreshold } from '@/lib/quality-score';
import { ComparisonQualityPopover } from './comparison-quality-popover';
import type { ComparisonUnifiedMetricsProps } from './types';

type MetricKey =
  | 'linesChanged'
  | 'filesChanged'
  | 'testFilesChanged'
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'durationMs'
  | 'costUsd'
  | 'jobCount';

interface MetricRowConfig {
  key: MetricKey;
  label: string;
  source: 'metrics' | 'telemetry';
  format: (value: number) => string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

const metricRows: MetricRowConfig[] = [
  { key: 'linesChanged', label: 'Lines Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'filesChanged', label: 'Files Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'testFilesChanged', label: 'Test Files Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'totalTokens', label: 'Total Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'inputTokens', label: 'Input Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'outputTokens', label: 'Output Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'durationMs', label: 'Duration', source: 'telemetry', format: formatDuration },
  { key: 'costUsd', label: 'Cost', source: 'telemetry', format: (v) => `$${v.toFixed(2)}` },
  { key: 'jobCount', label: 'Job Count', source: 'telemetry', format: (v) => v.toLocaleString() },
];

function getMetricValue(
  participant: ComparisonParticipantDetail,
  config: MetricRowConfig
): { state: string; value: number | null } {
  if (config.source === 'metrics') {
    const val = participant.metrics[config.key as keyof typeof participant.metrics] as number | null;
    return {
      state: val != null ? 'available' : 'unavailable',
      value: val,
    };
  }
  return participant.telemetry[config.key as keyof typeof participant.telemetry] as ComparisonEnrichmentValue<number>;
}

export function ComparisonUnifiedMetrics({ participants }: ComparisonUnifiedMetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metrics Comparison</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                Metric
              </th>
              {participants.map((p) => (
                <th key={p.ticketId} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {p.ticketKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((config) => {
              const values = participants.map((p) => {
                const ev = getMetricValue(p, config);
                return { ticketId: p.ticketId, state: ev.state, value: ev.value };
              });

              const availableValues = values
                .filter((v) => v.state === 'available' && v.value != null)
                .map((v) => v.value!);
              const maxValue = availableValues.length > 0 ? Math.max(...availableValues) : 1;
              const bestValue = availableValues.length > 0 ? Math.min(...availableValues) : null;

              return (
                <tr key={config.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {config.label}
                  </td>
                  {participants.map((p) => {
                    const ev = getMetricValue(p, config);

                    if (ev.state === 'pending') {
                      return (
                        <td key={p.ticketId} className="px-3 py-2 text-muted-foreground">
                          Pending
                        </td>
                      );
                    }

                    if (ev.state === 'unavailable' || ev.value == null) {
                      return (
                        <td key={p.ticketId} className="px-3 py-2 text-muted-foreground">
                          —
                        </td>
                      );
                    }

                    const isBest = ev.value === bestValue;
                    const barWidth = maxValue > 0 ? (ev.value / maxValue) * 100 : 0;
                    const formatted = config.format(ev.value);

                    return (
                      <td key={p.ticketId} className="px-3 py-2">
                        <div className="space-y-1">
                          <span className="text-foreground">{formatted}</span>
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <div
                              data-testid="metric-bar"
                              className={`h-1.5 rounded-full ${isBest ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Quality Score row - special handling with popover */}
            <tr className="border-b border-border last:border-0">
              <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                Quality Score
              </td>
              {participants.map((p) => {
                if (p.quality.state === 'pending') {
                  return (
                    <td key={p.ticketId} className="px-3 py-2 text-muted-foreground">
                      Pending
                    </td>
                  );
                }
                if (p.quality.state === 'unavailable' || p.quality.value == null) {
                  return (
                    <td key={p.ticketId} className="px-3 py-2 text-muted-foreground">
                      —
                    </td>
                  );
                }

                const formatted = `${p.quality.value} ${getScoreThreshold(p.quality.value)}`;

                return (
                  <td key={p.ticketId} className="px-3 py-2">
                    <ComparisonQualityPopover
                      qualityBreakdown={p.qualityBreakdown}
                      qualityScore={p.quality}
                      formattedScore={formatted}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
