'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComparisonParticipantDetail } from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getStatTheme } from './comparison-theme';
import type { ComparisonStatCardsProps } from './types';

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

function ProgressBar({
  participants,
  getValue,
  label,
  winnerId,
}: {
  participants: ComparisonParticipantDetail[];
  getValue: (p: ComparisonParticipantDetail) => { state: string; value: number | null };
  label: string;
  winnerId: number;
}) {
  const theme = getStatTheme(label);
  const availableValues = participants
    .map((p) => {
      const ev = getValue(p);
      return { ticketId: p.ticketId, value: ev.state === 'available' && ev.value != null ? ev.value : null };
    })
    .filter((e): e is { ticketId: number; value: number } => e.value !== null);

  const maxValue = Math.max(...availableValues.map((e) => e.value), 1);
  const winnerValue = availableValues.find((entry) => entry.ticketId === winnerId)?.value ?? 0;
  const width = maxValue > 0 ? (winnerValue / maxValue) * 100 : 0;

  return (
    <div className={cn('mt-4 h-2.5 w-full rounded-full', theme.barTrack)}>
      <div
        data-testid="stat-progress-bar"
        className={cn('h-2.5 rounded-full', theme.barFill)}
        style={{ width: `${Math.max(width, availableValues.length > 0 ? 14 : 0)}%` }}
      />
    </div>
  );
}

export function ComparisonStatCards({ winner, participants }: ComparisonStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statCardConfigs.map((config) => {
        const enrichment = config.getValue(winner);
        const displayValue = getDisplayValue(enrichment, config.format);
        const theme = getStatTheme(config.label);
        const cardId = config.label.toLowerCase().replace(/\s+/g, '-');

        return (
          <Card
            key={config.label}
            data-testid={`stat-card-${cardId}`}
            className={cn('border bg-ctp-mantle/75 shadow-lg backdrop-blur-sm', theme.border, theme.surface)}
          >
            <CardContent className="pt-5">
              <div className={cn('text-[11px] uppercase tracking-[0.22em]', theme.label)}>{config.label}</div>
              <div className="mt-2 text-[18px] font-extrabold tracking-[-0.05em] text-foreground">{displayValue}</div>
              <ProgressBar
                participants={participants}
                getValue={config.getValue}
                label={config.label}
                winnerId={winner.ticketId}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
