'use client';

import { useState, useCallback } from 'react';
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

/**
 * Heart-shaped SVG path for the health indicator.
 * Standard heart shape scaled to fit a 36x36 viewBox.
 */
const HEART_PATH = 'M18 32 C8 24 2 18 2 12 2 6 6 2 12 2 15 2 18 5 18 5 18 5 21 2 24 2 30 2 34 6 34 12 34 18 28 24 18 32Z';

function getHeartFillColor(score: number | null): string {
  if (score === null) return 'hsl(var(--muted-foreground) / 0.3)';
  if (score >= 90) return 'hsl(var(--ctp-green))';
  if (score >= 70) return 'hsl(var(--ctp-blue))';
  if (score >= 50) return 'hsl(var(--ctp-yellow))';
  return 'hsl(var(--ctp-red))';
}

function getHeartGlowStyle(score: number | null): React.CSSProperties {
  if (score === null) return {};
  const color = getHeartFillColor(score);
  return { filter: `drop-shadow(0 0 6px ${color})` };
}

export function HealthScoreHeart({ healthScore }: HealthScoreHeartProps) {
  const [open, setOpen] = useState(false);

  const globalScore = healthScore?.globalScore ?? null;
  const hasData = globalScore !== null;
  const displayText = hasData ? globalScore.toString() : '—';
  const fillColor = getHeartFillColor(globalScore);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="health-heart"
          onClick={handleClick}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="relative inline-flex items-center justify-center focus:outline-none"
          aria-label={hasData ? `Health score: ${globalScore}` : 'No health data'}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            style={getHeartGlowStyle(globalScore)}
            className="transition-all duration-200"
          >
            <path d={HEART_PATH} fill={fillColor} />
            <text
              x="18"
              y="20"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white font-bold"
              style={{ fontSize: hasData && globalScore >= 100 ? '9px' : '11px' }}
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
