'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getParticipantTheme } from './comparison-theme';
import { ScoreGauge } from './score-gauge';
import type { ComparisonHeroCardProps } from './types';

function getEnrichmentDisplay(
  enrichment: { state: string; value: number | null },
  format: (v: number) => string
): string {
  if (enrichment.state === 'available' && enrichment.value != null) {
    return format(enrichment.value);
  }
  if (enrichment.state === 'pending') return 'Pending';
  return 'N/A';
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
    <div className="flex min-w-[110px] flex-col items-center rounded-xl border border-white/10 bg-background/40 px-4 py-3 backdrop-blur-sm">
      <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</span>
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
  const winnerTheme = getParticipantTheme(1);
  const costValue = getEnrichmentDisplay(winner.telemetry.costUsd, (v) => `$${v.toFixed(2)}`);
  const durationValue = getEnrichmentDisplay(winner.telemetry.durationMs, formatDurationMs);
  const qualityValue = getEnrichmentDisplay(winner.quality, String);

  return (
    <Card className={cn('relative overflow-hidden border-white/10 bg-ctp-mantle/80 shadow-xl backdrop-blur-sm', winnerTheme.border)}>
      <div className={cn('absolute inset-0', winnerTheme.surfaceStrong)} aria-hidden="true" />
      <div
        className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-radial from-ctp-green/[0.22] via-ctp-green/[0.08] to-transparent blur-2xl"
        aria-hidden="true"
      />
      <CardContent className="relative pt-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="rounded-[1.75rem] border border-white/10 bg-background/20 p-4 backdrop-blur-sm">
            <ScoreGauge
              score={winner.score}
              size={132}
              strokeWidth={9}
              theme={winnerTheme}
              gradientId="winner-gauge"
            />
          </div>

          <div className="flex-1 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn('rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.32em]', winnerTheme.pill)}>
                  WINNER
                </Badge>
                <span className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Best overall recommendation
                </span>
              </div>

              <div>
                <h3 className="text-3xl font-extrabold tracking-[-0.06em] text-foreground">{winner.ticketKey}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{winner.title}</p>
              </div>
            </div>

            {keyDifferentiators.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {keyDifferentiators.map((diff, index) => (
                  <Badge key={diff} className={cn('rounded-full border px-3 py-1 text-xs font-medium', getParticipantTheme(index + 1).pill)}>
                    {diff}
                  </Badge>
                ))}
              </div>
            )}

            <div
              data-testid="comparison-recommendation"
              className="rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm text-foreground backdrop-blur-sm"
            >
              {recommendation}
            </div>

            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Generated {formatDate(generatedAt)} · Source: {sourceTicketKey}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <StatPill label="Cost" value={costValue} />
          <StatPill label="Duration" value={durationValue} />
          <StatPill label="Quality Score" value={qualityValue} />
        </div>
      </CardContent>
    </Card>
  );
}
