'use client';

import { useState } from 'react';
import { getScoreColorConfig } from '@/lib/health/score-calculator';
import type { ProjectWithCount } from '@/app/lib/types/project';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HealthScoreHeartProps {
  healthScore: ProjectWithCount['healthScore'];
}

const SUB_SCORE_LABELS: Array<{ key: keyof NonNullable<ProjectWithCount['healthScore']>; label: string }> = [
  { key: 'securityScore', label: 'Security' },
  { key: 'complianceScore', label: 'Compliance' },
  { key: 'testsScore', label: 'Tests' },
  { key: 'specSyncScore', label: 'Spec Sync' },
  { key: 'qualityGate', label: 'Quality Gate' },
  { key: 'reviewQualityScore', label: 'Review Quality' },
];

const HEART_PATH = 'M18 32 C8 24 2 18 2 12 2 6 6 2 12 2 15 2 18 5 18 5 18 5 21 2 24 2 30 2 34 6 34 12 34 18 28 24 18 32Z';

interface HeartColors {
  from: string;
  to: string;
  glow: string;
  stroke: string;
}

function getHeartColors(score: number | null): HeartColors {
  if (score === null) return {
    from: 'hsl(var(--muted-foreground) / 0.2)',
    to: 'hsl(var(--muted-foreground) / 0.3)',
    glow: 'transparent',
    stroke: 'hsl(var(--muted-foreground) / 0.15)',
  };
  if (score >= 90) return {
    from: 'hsl(var(--ctp-green))',
    to: 'hsl(var(--ctp-teal))',
    glow: 'hsl(var(--ctp-green) / 0.4)',
    stroke: 'hsl(var(--ctp-green) / 0.6)',
  };
  if (score >= 70) return {
    from: 'hsl(var(--ctp-blue))',
    to: 'hsl(var(--ctp-lavender))',
    glow: 'hsl(var(--ctp-blue) / 0.4)',
    stroke: 'hsl(var(--ctp-blue) / 0.6)',
  };
  if (score >= 50) return {
    from: 'hsl(var(--ctp-yellow))',
    to: 'hsl(var(--ctp-peach))',
    glow: 'hsl(var(--ctp-yellow) / 0.4)',
    stroke: 'hsl(var(--ctp-yellow) / 0.6)',
  };
  return {
    from: 'hsl(var(--ctp-red))',
    to: 'hsl(var(--ctp-maroon))',
    glow: 'hsl(var(--ctp-red) / 0.4)',
    stroke: 'hsl(var(--ctp-red) / 0.6)',
  };
}

export function HealthScoreHeart({ healthScore }: HealthScoreHeartProps) {
  const [open, setOpen] = useState(false);

  const globalScore = healthScore?.globalScore ?? null;
  const hasData = globalScore !== null;
  const displayText = hasData ? globalScore.toString() : '—';
  const colors = getHeartColors(globalScore);
  const gradientId = `heart-grad-${globalScore ?? 'null'}`;
  const glowId = `heart-glow-${globalScore ?? 'null'}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="health-heart"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="relative inline-flex items-center justify-center focus:outline-none group"
          aria-label={hasData ? `Health score: ${globalScore}` : 'No health data'}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 36 36"
            className="transition-transform duration-200 group-hover:scale-110"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.from} />
                <stop offset="100%" stopColor={colors.to} />
              </linearGradient>
              <filter id={glowId}>
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feFlood floodColor={colors.glow} result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g filter={hasData ? `url(#${glowId})` : undefined}>
              <path
                d={HEART_PATH}
                fill={`url(#${gradientId})`}
                stroke={colors.stroke}
                strokeWidth="0.8"
              />
              {/* Highlight on top-left for depth */}
              <path
                d={HEART_PATH}
                fill="url(#heart-shine)"
                opacity="0.25"
              />
            </g>
            {/* Shine gradient (shared) */}
            <defs>
              <linearGradient id="heart-shine" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                <stop offset="50%" stopColor="white" stopOpacity="0" />
              </linearGradient>
            </defs>
            <text
              x="18"
              y="17"
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(var(--ctp-crust))"
              fontWeight="800"
              fontSize={hasData && globalScore >= 100 ? '9' : '11'}
            >
              {displayText}
            </text>
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        side="bottom"
        align="end"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-sm font-semibold text-foreground mb-2">Health Breakdown</p>
        <div className="space-y-1.5">
          {SUB_SCORE_LABELS.map(({ key, label }) => {
            const value = healthScore ? (healthScore[key] as number | null) : null;
            const config = getScoreColorConfig(value);
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-semibold ${config.text}`}>
                  {value !== null ? value : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
