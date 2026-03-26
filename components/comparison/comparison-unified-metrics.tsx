'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getScoreThreshold } from '@/lib/quality-score';
import { getParticipantTheme } from './comparison-theme';
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

export function ComparisonUnifiedMetrics({ participants }: ComparisonUnifiedMetricsProps) {
  const participantThemes = participants.map((participant) => ({
    participant,
    theme: getParticipantTheme(participant.rank),
  }));

  return (
    <Card className="border-white/10 bg-ctp-mantle/80 shadow-xl backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Metrics Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div data-testid="metrics-legend" className="flex flex-wrap gap-2">
          {participantThemes.map(({ participant, theme }) => (
            <Badge
              key={participant.ticketId}
              variant="outline"
              className={cn('rounded-full px-3 py-1 text-xs', theme.border, theme.surface, theme.text)}
            >
              {participant.ticketKey}
            </Badge>
          ))}
        </div>

        <div className="space-y-4">
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
              <div key={config.key} className="rounded-2xl border border-white/10 bg-background/20 p-4">
                <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {config.label}
                </div>
                <div className="space-y-3">
                  {participantThemes.map(({ participant, theme }) => {
                    const ev = getMetricValue(participant, config);

                    if (ev.state === 'pending') {
                      return (
                        <div key={participant.ticketId} className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{participant.ticketKey}</span>
                          <span className="text-muted-foreground">Pending</span>
                        </div>
                      );
                    }

                    if (ev.state === 'unavailable' || ev.value == null) {
                      return (
                        <div key={participant.ticketId} className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{participant.ticketKey}</span>
                          <span className="text-muted-foreground">—</span>
                        </div>
                      );
                    }

                    const isBest = ev.value === bestValue;
                    const barWidth = maxValue > 0 ? (ev.value / maxValue) * 100 : 0;
                    const formatted = config.format(ev.value);

                    return (
                      <div key={participant.ticketId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{participant.ticketKey}</span>
                          <span
                            data-testid={`metric-value-${config.key}-${participant.ticketId}`}
                            className={cn('font-medium text-foreground', isBest && 'font-bold', isBest && theme.text)}
                          >
                            {formatted}
                          </span>
                        </div>
                        <div className={cn('h-2.5 w-full rounded-full', theme.barTrack)}>
                          <div
                            data-testid="metric-bar"
                            className={cn('h-2.5 rounded-full', theme.barFill)}
                            style={{ width: `${Math.max(barWidth, 12)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl border border-white/10 bg-background/20 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Quality Score
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {participantThemes.map(({ participant, theme }) => {
                if (participant.quality.state === 'pending') {
                  return (
                    <div key={participant.ticketId} className="rounded-xl border border-white/10 bg-background/20 p-3 text-sm text-muted-foreground">
                      {participant.ticketKey}: Pending
                    </div>
                  );
                }
                if (participant.quality.state === 'unavailable' || participant.quality.value == null) {
                  return (
                    <div key={participant.ticketId} className="rounded-xl border border-white/10 bg-background/20 p-3 text-sm text-muted-foreground">
                      {participant.ticketKey}: —
                    </div>
                  );
                }

                const formatted = `${participant.quality.value} ${getScoreThreshold(participant.quality.value)}`;

                return (
                  <div key={participant.ticketId} className={cn('rounded-xl border p-3', theme.border, theme.surface)}>
                    <div className={cn('mb-2 text-xs font-medium', theme.text)}>{participant.ticketKey}</div>
                    <ComparisonQualityPopover
                      qualityBreakdown={participant.qualityBreakdown}
                      qualityScore={participant.quality}
                      formattedScore={formatted}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
