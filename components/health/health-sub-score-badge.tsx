'use client';

import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';

interface HealthSubScoreBadgeProps {
  label: string;
  score: number | null;
}

export function HealthSubScoreBadge({ label, score }: HealthSubScoreBadgeProps) {
  const displayScore = score !== null ? score.toString() : '---';
  const colors = score !== null ? getScoreColor(score) : null;
  const threshold = score !== null ? getScoreThreshold(score) : null;

  return (
    <div className="aurora-bg-subtle flex items-center gap-2 rounded-md px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold ${colors?.text ?? 'text-muted-foreground'}`}
        title={threshold ?? 'No data'}
      >
        {displayScore}
      </span>
    </div>
  );
}
