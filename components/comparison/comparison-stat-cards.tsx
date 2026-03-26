'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ComparisonEnrichmentValue, ComparisonParticipantDetail } from '@/lib/types/comparison';
import type { ComparisonStatCardsProps } from './types';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

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
    format: formatDuration,
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
}: {
  participants: ComparisonParticipantDetail[];
  getValue: (p: ComparisonParticipantDetail) => { state: string; value: number | null };
  winnerId: number;
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
            className={`absolute top-0 h-2 w-2 rounded-full ${isWinner ? 'bg-primary' : 'bg-muted-foreground/50'}`}
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
        const displayValue = getDisplayValue(enrichment as ComparisonEnrichmentValue<number>, config.format);

        return (
          <Card key={config.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{config.label}</div>
              <div className="mt-1 text-xl font-bold text-foreground">{displayValue}</div>
              <MicroBar
                participants={participants}
                getValue={config.getValue}
                winnerId={winner.ticketId}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
