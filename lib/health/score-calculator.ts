import { getScoreThreshold, getScoreColor } from '@/lib/quality-score';

interface ModuleScores {
  securityScore: number | null;
  complianceScore: number | null;
  testsScore: number | null;
  specSyncScore: number | null;
  qualityGate: number | null;
}

/**
 * Calculate the global health score from available module sub-scores.
 * Uses proportional weight redistribution: each module gets equal weight (20%),
 * but only modules with non-null scores are included — weights are redistributed.
 *
 * Returns null if no modules have scores.
 */
export function calculateGlobalScore(modules: ModuleScores): number | null {
  const scores = [
    modules.securityScore,
    modules.complianceScore,
    modules.testsScore,
    modules.specSyncScore,
    modules.qualityGate,
  ].filter((s): s is number => s !== null);

  if (scores.length === 0) return null;

  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round(sum / scores.length);
}

/**
 * Get the display label for a global score.
 * Returns "No data yet" if score is null.
 */
export function getScoreLabel(score: number | null): string {
  if (score === null) return 'No data yet';
  return getScoreThreshold(score);
}

/**
 * Get the color config for a global score.
 * Returns muted colors if score is null.
 */
export function getScoreColorConfig(score: number | null): { text: string; bg: string; fill: string } {
  if (score === null) {
    return { text: 'text-muted-foreground', bg: 'bg-muted', fill: 'bg-muted' };
  }
  return getScoreColor(score);
}
