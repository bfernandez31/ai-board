'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getAccentColorByRank } from '@/lib/comparison/accent-colors';
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
  const costValue = getEnrichmentDisplay(winner.telemetry.costUsd, (v) => `$${v.toFixed(2)}`);
  const durationValue = getEnrichmentDisplay(winner.telemetry.durationMs, formatDurationMs);
  const qualityValue = getEnrichmentDisplay(winner.quality, String);
  const accent = getAccentColorByRank(winner.rank);

  return (
    <Card className={`relative overflow-hidden ${accent.bgSubtle} ${accent.border}`}>
      <div
        data-testid="glow-orb"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ctp-green/10 blur-3xl"
      />
      <CardContent className="relative pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <ScoreGauge score={winner.score} size={120} strokeWidth={8} accentColor={accent.hsl} />

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-foreground">{winner.ticketKey}</h3>
              <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${accent.bgMedium} ${accent.text}`}>
                WINNER
              </span>
            </div>

            <div
              data-testid="recommendation-container"
              className="rounded-lg border border-border bg-background/50 px-4 py-2"
            >
              <p className="text-sm text-foreground">{recommendation}</p>
            </div>

            {keyDifferentiators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keyDifferentiators.map((diff) => (
                  <span
                    key={diff}
                    data-testid="differentiator-pill"
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${accent.bgSubtle} ${accent.text} ${accent.border}`}
                  >
                    {diff}
                  </span>
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
