import { getScoreThreshold, getScoreColor } from '@/lib/quality-score';

export { getScoreThreshold, getScoreColor };

/**
 * Calculate global health score from available module sub-scores.
 * Uses equal weighting with redistribution for missing modules.
 * 5 contributing modules (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC, QUALITY_GATE) at 20% each.
 * When fewer modules have scores, weight is redistributed equally.
 * Returns null when no modules have scores.
 */
export function calculateGlobalScore(
  subScores: Partial<Record<string, number | null>>
): number | null {
  const contributingKeys = ['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC', 'QUALITY_GATE'];

  const availableScores: number[] = [];
  for (const key of contributingKeys) {
    const score = subScores[key];
    if (score != null) {
      availableScores.push(score);
    }
  }

  if (availableScores.length === 0) {
    return null;
  }

  const sum = availableScores.reduce((acc, s) => acc + s, 0);
  return Math.round(sum / availableScores.length);
}
