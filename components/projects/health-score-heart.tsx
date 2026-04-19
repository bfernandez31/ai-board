'use client';

import { useId, useState } from 'react';
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

const HEART_PATH =
  'M22 33.5 C22 33.5 10 26 10 17.5 C10 13 13.5 10 17 10 ' +
  'C19.5 10 21 11.5 22 13 C23 11.5 24.5 10 27 10 C30.5 10 34 13 ' +
  '34 17.5 C34 26 22 33.5 22 33.5 Z';

const TOP = 10;
const BOTTOM = 33.5;
const USABLE = BOTTOM - TOP;

function getHeartColorClass(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 85) return 'text-emerald-400';
  if (score >= 60) return 'text-violet-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function HealthScoreHeart({ healthScore }: HealthScoreHeartProps) {
  const [open, setOpen] = useState(false);
  const reactId = useId();
  const clipId = `heart-clip-${reactId.replace(/:/g, '')}`;

  const globalScore = healthScore?.globalScore ?? null;
  const hasData = globalScore !== null;
  const clamped = hasData ? Math.max(0, Math.min(100, globalScore)) : 0;
  const displayText = hasData ? Math.round(clamped).toString() : '—';
  const colorClass = getHeartColorClass(globalScore);

  const fillHeight = (clamped / 100) * USABLE;
  const rectY = BOTTOM - fillHeight;
  const rectH = BOTTOM - rectY + 0.5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="health-heart"
          data-score={hasData ? globalScore : 'null'}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="relative inline-flex items-center justify-center focus:outline-none group"
          aria-label={hasData ? `Project health: ${globalScore} out of 100` : 'No health data'}
        >
          <span
            className={`relative inline-block transition-transform duration-200 group-hover:scale-110 ${colorClass}`}
            style={{ width: 55, height: 50, lineHeight: 0 }}
          >
            <svg viewBox="0 0 44 40" width="100%" height="100%">
              <defs>
                <clipPath id={clipId}>
                  <path d={HEART_PATH} />
                </clipPath>
              </defs>
              <path
                d={HEART_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {hasData && (
                <rect
                  x="0"
                  y={rectY}
                  width="44"
                  height={rectH}
                  fill="currentColor"
                  fillOpacity="0.22"
                  clipPath={`url(#${clipId})`}
                />
              )}
            </svg>
            <span
              className="absolute inset-0 grid place-items-center font-mono font-bold text-[12px] text-zinc-100 pointer-events-none pt-[4px] [text-shadow:0_1px_2px_rgb(0_0_0_/_0.5)]"
            >
              {displayText}
            </span>
          </span>
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
