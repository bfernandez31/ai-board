'use client';

import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { ProjectHealthScore } from '@/app/lib/types/project';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HealthHeartIndicatorProps {
  healthScore: ProjectHealthScore | null;
}

const SUB_SCORES: { key: keyof Omit<ProjectHealthScore, 'globalScore'>; label: string }[] = [
  { key: 'securityScore', label: 'Security' },
  { key: 'complianceScore', label: 'Compliance' },
  { key: 'testsScore', label: 'Tests' },
  { key: 'specSyncScore', label: 'Spec Sync' },
  { key: 'qualityGate', label: 'Quality Gate' },
  { key: 'reviewQualityScore', label: 'Review Quality' },
];

function getHeartFillColor(score: number | null): string {
  if (score === null) return 'fill-muted-foreground';
  if (score >= 90) return 'fill-ctp-green';
  if (score >= 70) return 'fill-ctp-blue';
  if (score >= 50) return 'fill-ctp-yellow';
  return 'fill-ctp-red';
}

function getHeartGlowClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 90) return 'drop-shadow-[0_0_6px_rgba(166,227,161,0.5)]';
  if (score >= 70) return 'drop-shadow-[0_0_6px_rgba(137,180,250,0.5)]';
  if (score >= 50) return 'drop-shadow-[0_0_6px_rgba(249,226,175,0.5)]';
  return 'drop-shadow-[0_0_6px_rgba(243,139,168,0.5)]';
}

export function HealthHeartIndicator({ healthScore }: HealthHeartIndicatorProps) {
  const globalScore = healthScore?.globalScore ?? null;
  const fillColor = getHeartFillColor(globalScore);
  const glowClass = getHeartGlowClass(globalScore);
  const displayValue = globalScore !== null ? globalScore.toString() : '—';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center focus:outline-none"
          onClick={(e) => e.stopPropagation()}
          data-testid="health-heart-indicator"
          aria-label={globalScore !== null ? `Health score: ${globalScore}` : 'No health data'}
        >
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            className={`${fillColor} ${glowClass} transition-all duration-200`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none ${
              globalScore !== null ? 'text-white' : 'text-muted-foreground'
            }`}
            style={{ paddingTop: '1px' }}
          >
            {displayValue}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        side="bottom"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Health Sub-Scores</p>
          {SUB_SCORES.map(({ key, label }) => {
            const score = healthScore?.[key] ?? null;
            const colors = score !== null ? getScoreColor(score) : null;
            const threshold = score !== null ? getScoreThreshold(score) : null;
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{label}</span>
                <span
                  className={`font-semibold ${colors?.text ?? 'text-muted-foreground'}`}
                  title={threshold ?? 'No data'}
                >
                  {score !== null ? score : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
