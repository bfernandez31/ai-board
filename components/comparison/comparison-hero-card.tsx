'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from './score-gauge';
import type { ComparisonHeroCardProps } from './types';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface StatPillProps {
  label: string;
  value: string;
}

function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-background px-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function ComparisonHeroCard({
  winner,
  recommendation,
  keyDifferentiators,
  generatedAt,
  sourceTicketKey,
}: ComparisonHeroCardProps) {
  const costValue =
    winner.telemetry.costUsd.state === 'available'
      ? `$${winner.telemetry.costUsd.value!.toFixed(2)}`
      : winner.telemetry.costUsd.state === 'pending'
        ? 'Pending'
        : 'N/A';

  const durationValue =
    winner.telemetry.durationMs.state === 'available'
      ? formatDuration(winner.telemetry.durationMs.value!)
      : winner.telemetry.durationMs.state === 'pending'
        ? 'Pending'
        : 'N/A';

  const qualityValue =
    winner.quality.state === 'available'
      ? String(winner.quality.value!)
      : winner.quality.state === 'pending'
        ? 'Pending'
        : 'N/A';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <ScoreGauge score={winner.score} size={120} strokeWidth={8} />

          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-2xl font-bold text-foreground">{winner.ticketKey}</h3>
              <p className="mt-1 text-sm text-foreground">{recommendation}</p>
            </div>

            {keyDifferentiators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keyDifferentiators.map((diff) => (
                  <Badge key={diff} variant="secondary">
                    {diff}
                  </Badge>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Generated {formatDate(generatedAt)} · Source: {sourceTicketKey}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
          <StatPill label="Cost" value={costValue} />
          <StatPill label="Duration" value={durationValue} />
          <StatPill label="Quality Score" value={qualityValue} />
        </div>
      </CardContent>
    </Card>
  );
}
