'use client';

import { Badge } from '@/components/ui/badge';
import { getScoreThreshold, getScoreLevel } from '@/lib/quality-score';

interface QualityScoreBadgeProps {
  score: number | null;
}

/**
 * QualityScoreBadge — quality score (0-100) using the 4-tier quality rampe:
 *   Excellent (90+) → best (green)
 *   Good (70-89)    → high (blue)
 *   Fair (50-69)    → med  (yellow)
 *   Poor (0-49)     → low  (red)
 */
export function QualityScoreBadge({ score }: QualityScoreBadgeProps) {
  if (score == null) return null;

  const threshold = getScoreThreshold(score);
  const level = getScoreLevel(score);
  if (level === null) return null;

  return (
    <Badge
      variant="attribute"
      kind="quality"
      level={level}
      className="shrink-0"
      data-testid="quality-score-badge"
      title={`Quality Score: ${score}/100 (${threshold})`}
    >
      {score}
    </Badge>
  );
}
