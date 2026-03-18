'use client';

import { Badge } from '@/components/ui/badge';
import { getScoreThreshold, getScoreColor } from '@/lib/quality-score';

interface QualityScoreBadgeProps {
  score: number | null;
}

/**
 * QualityScoreBadge displays a small colored badge with the quality score.
 * Color thresholds: Excellent (90-100) green, Good (70-89) blue, Fair (50-69) amber, Poor (0-49) red.
 * Returns null if score is null.
 */
export function QualityScoreBadge({ score }: QualityScoreBadgeProps) {
  if (score == null) return null;

  const threshold = getScoreThreshold(score);
  const colors = getScoreColor(score);

  return (
    <Badge
      variant="outline"
      className={`text-xs shrink-0 px-1.5 py-0.5 font-semibold ${colors.text} ${colors.bg}`}
      data-testid="quality-score-badge"
      title={`Quality Score: ${score}/100 (${threshold})`}
    >
      {score}
    </Badge>
  );
}
