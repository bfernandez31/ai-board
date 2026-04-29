'use client';

import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { getScoreThreshold, getScoreLevel } from '@/lib/quality-score';

interface QualityScoreBadgeProps {
  score: number | null;
  /** When true, render as the compact ticket-card variant (no bg/border, just colored text). */
  compact?: boolean;
}

/**
 * QualityScoreBadge — quality score (0-100) using the 4-tier quality rampe:
 *   Excellent (90+) → best (green)
 *   Good (70-89)    → high (blue)
 *   Fair (50-69)    → med  (yellow)
 *   Poor (0-49)     → low  (red)
 *
 * Use `compact` for ticket cards / kanban density. Default renders the
 * full-block attribute badge with dot + border.
 */
export function QualityScoreBadge({ score, compact = false }: QualityScoreBadgeProps): React.ReactElement | null {
  if (score == null) return null;

  const threshold = getScoreThreshold(score);
  const level = getScoreLevel(score);
  if (level === null) return null;

  return (
    <Badge
      variant={compact ? 'attribute-tc' : 'attribute'}
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
