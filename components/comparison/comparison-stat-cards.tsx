'use client';

import type { ComparisonParticipantDetail } from '@/lib/types/comparison';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { STAT_CARD_COLORS } from './participant-colors';
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

function MicroBar({
  participants,
  getValue,
  winnerId,
  barColor,
}: {
  participants: ComparisonParticipantDetail[];
  getValue: (p: ComparisonParticipantDetail) => { state: string; value: number | null };
  winnerId: number;
  barColor: string;
}) {
  const availableValues = participants
    .map((p) => {
      const ev = getValue(p);
      return { ticketId: p.ticketId, value: ev.state === 'available' && ev.value != null ? ev.value : null };
    })
    .filter((e): e is { ticketId: number; value: number } => e.value !== null);

  const maxValue = Math.max(...availableValues.map((e) => e.value), 1);

  return (
    <div className="relative mt-3 h-2 w-full rounded-full bg-foreground/[0.06]">
      {availableValues.map((entry) => {
        const position = (entry.value / maxValue) * 100;
        const isWinner = entry.ticketId === winnerId;
        return (
          <div
            key={entry.ticketId}
            data-testid="micro-bar-marker"
            className={`absolute top-0 h-2 w-2 rounded-full ${isWinner ? barColor : 'bg-muted-foreground/30'}`}
            style={{ left: `calc(${Math.min(position, 100)}% - 4px)` }}
          />
        );
      })}
    </div>
  );
}

export function ComparisonStatCards({ winner, participants }: ComparisonStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {statCardConfigs.map((config, i) => {
        const enrichment = config.getValue(winner);
        const displayValue = getDisplayValue(enrichment, config.format);
        const theme = STAT_CARD_COLORS[i]!;

        return (
          <div
            key={config.label}
            className={`rounded-xl border p-5 ${theme.bgSubtle} ${theme.border}`}
          >
            <div className={`text-xs font-medium uppercase tracking-wider ${theme.text}`}>
              {config.label}
            </div>
            <div className="mt-1.5 text-lg font-extrabold tracking-tight text-foreground">
              {displayValue}
            </div>
            <MicroBar
              participants={participants}
              getValue={config.getValue}
              winnerId={winner.ticketId}
              barColor={theme.bar}
            />
          </div>
        );
      })}
    </div>
  );
}
