/**
 * Quality Score Utilities
 *
 * Shared types and helper functions for quality score display and computation.
 * Quality scores are computed by code review agents during VERIFY workflow
 * and stored on the Job model as an integer (0-100) with JSON dimension details.
 */

export type ScoreThreshold = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface DimensionScore {
  name: string;
  agentId: string;
  score: number;
  weight: number;
  weightedScore: number;
}

export interface QualityScoreDetails {
  dimensions: DimensionScore[];
  threshold: ScoreThreshold;
  computedAt: string;
}

/** Fixed dimension definitions with weights summing to 1.0 */
export const DIMENSION_WEIGHTS: Record<string, number> = {
  'bug-detection': 0.30,
  'compliance': 0.30,
  'code-comments': 0.20,
  'historical-context': 0.10,
  'pr-comments': 0.10,
};

/**
 * Returns the threshold label for a given score.
 * 90-100: Excellent, 70-89: Good, 50-69: Fair, 0-49: Poor
 */
export function getScoreThreshold(score: number): ScoreThreshold {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

/**
 * Returns Tailwind CSS classes for the score's threshold color.
 * Includes both light and dark mode variants.
 */
export function getScoreColor(score: number): { text: string; bg: string } {
  if (score >= 90) {
    return {
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-950',
    };
  }
  if (score >= 70) {
    return {
      text: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-950',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-950',
    };
  }
  return {
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950',
  };
}

/**
 * Parses the qualityScoreDetails JSON string into a typed object.
 * Returns null if the input is null, undefined, or invalid JSON.
 */
export function parseQualityScoreDetails(details: string | null | undefined): QualityScoreDetails | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as QualityScoreDetails;
  } catch {
    return null;
  }
}

/**
 * Computes the weighted quality score from dimension scores.
 * Returns a rounded integer (0-100).
 */
export function computeQualityScore(dimensions: DimensionScore[]): number {
  const total = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  return Math.round(total);
}
