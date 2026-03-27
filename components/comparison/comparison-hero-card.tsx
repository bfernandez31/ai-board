'use client';

import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { ScoreGauge } from './score-gauge';
import { getParticipantColor } from './participant-colors';
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
    <div className="flex flex-col items-center rounded-lg border border-foreground/10 bg-foreground/[0.03] px-5 py-2.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

const DIFFERENTIATOR_COLORS = [
  'border-ctp-green/30 bg-ctp-green/10 text-ctp-green',
  'border-ctp-blue/30 bg-ctp-blue/10 text-ctp-blue',
  'border-ctp-mauve/30 bg-ctp-mauve/10 text-ctp-mauve',
  'border-ctp-peach/30 bg-ctp-peach/10 text-ctp-peach',
  'border-ctp-flamingo/30 bg-ctp-flamingo/10 text-ctp-flamingo',
  'border-ctp-yellow/30 bg-ctp-yellow/10 text-ctp-yellow',
] as const;

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
  const winnerColor = getParticipantColor(1);

  return (
    <div className="relative overflow-hidden rounded-xl border border-ctp-green/20 bg-gradient-to-br from-ctp-green/[0.08] to-transparent p-6">
      {/* Radial glow orb */}
      <div
        className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, hsl(var(--ctp-green) / 0.4), transparent 70%)' }}
      />

      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <ScoreGauge
            score={winner.score}
            size={120}
            strokeWidth={8}
            strokeColor={winnerColor.stroke}
            glow={winnerColor.glow}
          />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                {winner.ticketKey}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-ctp-green/30 to-ctp-green/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-ctp-green">
                <Trophy className="h-3 w-3" />
                Winner
              </span>
            </div>

            <div className="mt-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] px-4 py-2.5">
              <p className="text-sm text-foreground">{recommendation}</p>
            </div>
          </div>

          {keyDifferentiators.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keyDifferentiators.map((diff, i) => (
                <Badge
                  key={diff}
                  variant="outline"
                  className={DIFFERENTIATOR_COLORS[i % DIFFERENTIATOR_COLORS.length]}
                >
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

      <div className="relative mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
        <StatPill label="Cost" value={costValue} />
        <StatPill label="Duration" value={durationValue} />
        <StatPill label="Quality Score" value={qualityValue} />
      </div>
    </div>
  );
}
