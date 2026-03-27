'use client';

import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getScoreThreshold } from '@/lib/quality-score';
import { ComparisonQualityPopover } from './comparison-quality-popover';
import { getParticipantColor } from './participant-colors';
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

const metricRows: MetricRowConfig[] = [
  { key: 'linesChanged', label: 'Lines Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'filesChanged', label: 'Files Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'testFilesChanged', label: 'Test Files Changed', source: 'metrics', format: (v) => v.toLocaleString() },
  { key: 'totalTokens', label: 'Total Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'inputTokens', label: 'Input Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'outputTokens', label: 'Output Tokens', source: 'telemetry', format: (v) => v.toLocaleString() },
  { key: 'durationMs', label: 'Duration', source: 'telemetry', format: formatDurationMs },
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

function ParticipantLegend({ participants }: { participants: ComparisonParticipantDetail[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {participants.map((p) => {
        const color = getParticipantColor(p.rank);
        return (
          <div key={p.ticketId} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${color.bgMedium}`}
              style={{ backgroundColor: color.stroke }}
            />
            <span className="text-xs text-muted-foreground">{p.ticketKey}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ComparisonUnifiedMetrics({ participants }: ComparisonUnifiedMetricsProps) {
  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Metrics Comparison
      </h3>
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <ParticipantLegend participants={participants} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="sticky left-0 z-10 bg-transparent px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metric
                </th>
                {participants.map((p) => {
                  const color = getParticipantColor(p.rank);
                  return (
                    <th key={p.ticketId} className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${color.text}`}>
                      {p.ticketKey}
                    </th>
                  );
                })}
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
                  <tr key={config.key} className="border-b border-foreground/5 last:border-0">
                    <td className="sticky left-0 z-10 bg-transparent px-3 py-2.5 font-medium text-foreground">
                      {config.label}
                    </td>
                    {participants.map((p) => {
                      const ev = getMetricValue(p, config);
                      const color = getParticipantColor(p.rank);

                      if (ev.state === 'pending') {
                        return (
                          <td key={p.ticketId} className="px-3 py-2.5 text-muted-foreground">
                            Pending
                          </td>
                        );
                      }

                      if (ev.state === 'unavailable' || ev.value == null) {
                        return (
                          <td key={p.ticketId} className="px-3 py-2.5 text-muted-foreground">
                            —
                          </td>
                        );
                      }

                      const isBest = ev.value === bestValue;
                      const barWidth = maxValue > 0 ? (ev.value / maxValue) * 100 : 0;
                      const formatted = config.format(ev.value);

                      return (
                        <td key={p.ticketId} className="px-3 py-2.5">
                          <div className="space-y-1.5">
                            <span className={isBest ? `font-bold ${color.text}` : 'text-foreground'}>
                              {formatted}
                            </span>
                            <div className="h-1.5 w-full rounded-full bg-foreground/[0.06]">
                              <div
                                data-testid="metric-bar"
                                className="h-1.5 rounded-full bg-gradient-to-r to-transparent"
                                style={{
                                  width: `${barWidth}%`,
                                  backgroundImage: `linear-gradient(to right, ${color.stroke}, transparent)`,
                                }}
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
              <tr className="border-b border-foreground/5 last:border-0">
                <td className="sticky left-0 z-10 bg-transparent px-3 py-2.5 font-medium text-foreground">
                  Quality Score
                </td>
                {participants.map((p) => {
                  if (p.quality.state === 'pending') {
                    return (
                      <td key={p.ticketId} className="px-3 py-2.5 text-muted-foreground">
                        Pending
                      </td>
                    );
                  }
                  if (p.quality.state === 'unavailable' || p.quality.value == null) {
                    return (
                      <td key={p.ticketId} className="px-3 py-2.5 text-muted-foreground">
                        —
                      </td>
                    );
                  }

                  const formatted = `${p.quality.value} ${getScoreThreshold(p.quality.value)}`;

                  return (
                    <td key={p.ticketId} className="px-3 py-2.5">
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
        </div>
      </div>
    </div>
  );
}
