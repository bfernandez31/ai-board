'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatDurationMs } from '@/lib/comparison/format-duration';
import { getAccentColorByRank } from '@/lib/comparison/accent-colors';
import { ComparisonCardMetadata } from './comparison-card-metadata';
import { ScoreGauge } from './score-gauge';
import type { ComparisonHeroCardProps } from './types';

interface EnrichmentValue {
  state: string;
  value: number | null;
}

interface GradientTheme {
  from: string;
  to: string;
  text: string;
}

interface StatPillTheme extends GradientTheme {
  border: string;
  label: string;
}

function getEnrichmentDisplay(
  enrichment: EnrichmentValue,
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

/** Gradient color pairs for differentiator pills, cycling through aurora palette */
const PILL_GRADIENTS: GradientTheme[] = [
  { from: '--ctp-sapphire', to: '--ctp-mauve', text: '--ctp-sapphire' },
  { from: '--ctp-mauve', to: '--ctp-pink', text: '--ctp-mauve' },
  { from: '--ctp-pink', to: '--ctp-peach', text: '--ctp-pink' },
  { from: '--ctp-sapphire', to: '--ctp-lavender', text: '--ctp-lavender' },
  { from: '--ctp-mauve', to: '--ctp-sapphire', text: '--ctp-mauve' },
  { from: '--ctp-pink', to: '--ctp-mauve', text: '--ctp-pink' },
];

/** Gradient styles for the 3 hero stat pills */
const STAT_PILL_STYLES: StatPillTheme[] = [
  { label: 'Cost', from: '--ctp-yellow', to: '--ctp-peach', text: '--ctp-yellow', border: '--ctp-yellow' },
  { label: 'Duration', from: '--ctp-sapphire', to: '--ctp-mauve', text: '--ctp-sapphire', border: '--ctp-sapphire' },
  { label: 'Quality Score', from: '--ctp-mauve', to: '--ctp-pink', text: '--ctp-mauve', border: '--ctp-mauve' },
];

interface StatPillProps {
  label: string;
  value: string;
  theme: StatPillTheme;
}

function StatPill({ label, value, theme }: StatPillProps): JSX.Element {
  return (
    <div
      className="flex flex-col items-center rounded-lg border px-4 py-2"
      style={{
        background: `linear-gradient(135deg, hsl(var(${theme.from}) / 0.07), hsl(var(${theme.to}) / 0.1))`,
        borderColor: `hsl(var(${theme.border}) / 0.25)`,
        boxShadow: `0 0 8px hsl(var(${theme.border}) / 0.05)`,
      }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: `hsl(var(${theme.text}))` }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function getDifferentiatorStyle(index: number): React.CSSProperties {
  const gradient = PILL_GRADIENTS[index % PILL_GRADIENTS.length] ?? PILL_GRADIENTS[0]!;

  return {
    background: `linear-gradient(135deg, hsl(var(${gradient.from}) / 0.1), hsl(var(${gradient.to}) / 0.1))`,
    border: `1px solid hsl(var(${gradient.from}) / 0.2)`,
    color: `hsl(var(${gradient.text}))`,
  };
}

export function ComparisonHeroCard({
  winner,
  recommendation,
  keyDifferentiators,
  generatedAt,
  sourceTicketKey,
}: ComparisonHeroCardProps): JSX.Element {
  const costValue = getEnrichmentDisplay(winner.telemetry.costUsd, (v) => `$${v.toFixed(2)}`);
  const durationValue = getEnrichmentDisplay(winner.telemetry.durationMs, formatDurationMs);
  const qualityValue = getEnrichmentDisplay(winner.quality, String);
  const accent = getAccentColorByRank(winner.rank);
  const statPills = [
    { label: 'Cost', theme: STAT_PILL_STYLES[0]!, value: costValue },
    { label: 'Duration', theme: STAT_PILL_STYLES[1]!, value: durationValue },
    { label: 'Quality Score', theme: STAT_PILL_STYLES[2]!, value: qualityValue },
  ];

  return (
    <Card
      className="relative overflow-hidden border-ctp-mauve/20 aurora-bg-section"
    >
      {/* Aurora ambient glow */}
      <div
        data-testid="glow-orb"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl aurora-orb-blue"
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full blur-3xl aurora-orb-pink"
      />

      <CardContent className="relative pt-6">
        <ComparisonCardMetadata
          workflowType={winner.workflowType}
          agent={winner.agent}
          iconSize={20}
          className="absolute right-6 top-6"
        />

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div
            className="rounded-full aurora-glow-score"
          >
            <ScoreGauge score={winner.score} size={120} strokeWidth={8} accentColor={accent.hsl} />
          </div>

          <div className="flex-1 space-y-3 pr-24 sm:pr-36">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-foreground">{winner.ticketKey}</h3>
              <span
                className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-ctp-lavender aurora-badge-winner"
              >
                WINNER
              </span>
            </div>

            <div
              data-testid="recommendation-container"
              className="rounded-lg border border-ctp-mauve/15 px-4 py-2 aurora-bg-recommendation"
            >
              <p className="text-sm text-foreground">{recommendation}</p>
            </div>

            {keyDifferentiators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keyDifferentiators.map((diff, i) => {
                  return (
                    <span
                      key={diff}
                      data-testid="differentiator-pill"
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                      style={getDifferentiatorStyle(i)}
                    >
                      {diff}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Generated {formatDate(generatedAt)} · Source: {sourceTicketKey}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
          {statPills.map((pill) => (
            <StatPill key={pill.label} label={pill.label} value={pill.value} theme={pill.theme} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
