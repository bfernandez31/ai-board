'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import type { ComparisonStatCardsProps } from './types';

interface StatCardTheme {
  text: string;
  bgSubtle: string;
  border: string;
  barGradient: string;
}

const DEFAULT_THEME: StatCardTheme = {
  text: 'text-ctp-yellow',
  bgSubtle: 'bg-ctp-yellow/10',
  border: 'border-ctp-yellow/20',
  barGradient: 'bg-ctp-yellow',
};

const STAT_THEMES: Record<string, StatCardTheme> = {
  Cost: {
    text: 'text-ctp-yellow',
    bgSubtle: 'bg-ctp-yellow/10',
    border: 'border-ctp-yellow/20',
    barGradient: 'bg-ctp-yellow',
  },
  Duration: {
    text: 'text-ctp-blue',
    bgSubtle: 'bg-ctp-blue/10',
    border: 'border-ctp-blue/20',
    barGradient: 'bg-ctp-blue',
  },
  'Quality Score': {
    text: 'text-ctp-green',
    bgSubtle: 'bg-ctp-green/10',
    border: 'border-ctp-green/20',
    barGradient: 'bg-ctp-green',
  },
  'Files Changed': {
    text: 'text-ctp-mauve',
    bgSubtle: 'bg-ctp-mauve/10',
    border: 'border-ctp-mauve/20',
    barGradient: 'bg-ctp-mauve',
  },
};

interface StatCardConfig {
  label: string;
  getValue: (p: ComparisonParticipantDetail) => { state: string; value: number | null };
  format: (v: number) => string;
}

const statCardConfigs: StatCardConfig[] = [
  {
    label: 'Cost',
    getValue: (p) => p.telemetry.costUsd,
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    label: 'Duration',
    getValue: (p) => p.telemetry.durationMs,
    format: formatDurationMs,
  },
  {
    label: 'Quality Score',
    getValue: (p) => p.quality,
    format: (v) => String(v),
  },
  {
    label: 'Files Changed',
    getValue: (p) => ({
      state: p.metrics.filesChanged != null ? 'available' : 'unavailable',
      value: p.metrics.filesChanged,
    }),
    format: (v) => String(v),
  },
];

function getDisplayValue(
  enrichment: { state: string; value: number | null },
  format: (v: number) => string
): string {
  if (enrichment.state === 'available' && enrichment.value != null) {
    return format(enrichment.value);
  }
  if (enrichment.state === 'pending') return 'Pending';
  return 'N/A';
}

function MicroBar({
  participants,
  getValue,
  winnerId,
  theme,
}: {
  participants: ComparisonParticipantDetail[];
  getValue: (p: ComparisonParticipantDetail) => { state: string; value: number | null };
  winnerId: number;
  theme: StatCardTheme;
}) {
  const availableValues = participants
    .map((p) => {
      const ev = getValue(p);
      return { ticketId: p.ticketId, value: ev.state === 'available' && ev.value != null ? ev.value : null };
    })
    .filter((e): e is { ticketId: number; value: number } => e.value !== null);

  const maxValue = Math.max(...availableValues.map((e) => e.value), 1);

  return (
    <div className="relative mt-2 h-2 w-full rounded-full bg-muted">
      {availableValues.map((entry) => {
        const position = (entry.value / maxValue) * 100;
        const isWinner = entry.ticketId === winnerId;
        return (
          <div
            key={entry.ticketId}
            data-testid="micro-bar-marker"
            className={`absolute top-0 h-2 w-2 rounded-full ${isWinner ? theme.barGradient : 'bg-muted-foreground/50'}`}
            style={{ left: `calc(${Math.min(position, 100)}% - 4px)` }}
          />
        );
      })}
    </div>
  );
}

export function ComparisonStatCards({ winner, participants }: ComparisonStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statCardConfigs.map((config) => {
        const enrichment = config.getValue(winner);
        const displayValue = getDisplayValue(enrichment, config.format);
        const theme = STAT_THEMES[config.label] ?? DEFAULT_THEME;

        return (
          <Card key={config.label} data-testid="stat-card" className={`${theme.bgSubtle} border ${theme.border}`}>
            <CardContent className="pt-4">
              <div className={`text-xs font-medium ${theme.text}`}>{config.label}</div>
              <div className={`mt-1 text-lg font-extrabold tracking-tight text-foreground`}>{displayValue}</div>
              <MicroBar
                participants={participants}
                getValue={config.getValue}
                winnerId={winner.ticketId}
                theme={theme}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
