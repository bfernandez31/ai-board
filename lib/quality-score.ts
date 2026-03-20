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

export interface QualityScoreDimensionDefinition {
  name: string;
  agentId: string;
  weight: number;
}

export interface QualityScoreDetails {
  dimensions: DimensionScore[];
  threshold: ScoreThreshold;
  computedAt: string;
}

/** Shared quality score dimension config for scoring, analytics, and display ordering. */
export const QUALITY_SCORE_DIMENSIONS: QualityScoreDimensionDefinition[] = [
  { name: 'Compliance', agentId: 'compliance', weight: 0.4 },
  { name: 'Bug Detection', agentId: 'bug-detection', weight: 0.3 },
  { name: 'Code Comments', agentId: 'code-comments', weight: 0.2 },
  { name: 'Historical Context', agentId: 'historical-context', weight: 0.1 },
  { name: 'Spec Sync', agentId: 'spec-sync', weight: 0.0 },
];

export const DIMENSION_WEIGHTS: Record<string, number> = Object.fromEntries(
  QUALITY_SCORE_DIMENSIONS.map((dimension) => [dimension.agentId, dimension.weight])
);

const QUALITY_SCORE_DIMENSION_ORDER = new Map(
  QUALITY_SCORE_DIMENSIONS.flatMap((dimension, index) => [
    [dimension.agentId, index],
    [dimension.name, index],
  ])
);

function getDimensionOrderKey(identifier: string): number {
  return QUALITY_SCORE_DIMENSION_ORDER.get(identifier) ?? Number.MAX_SAFE_INTEGER;
}

export function getQualityScoreDimensionOrder(
  dimension: Pick<DimensionScore, 'name' | 'agentId'> | Pick<QualityScoreDimensionDefinition, 'name' | 'agentId'> | { name: string; agentId?: string }
): number {
  return getDimensionOrderKey(dimension.agentId ?? dimension.name);
}

export function sortQualityScoreDimensions<T extends { name: string; agentId?: string }>(
  dimensions: T[]
): T[] {
  return [...dimensions].sort((left, right) => {
    const leftOrder = getQualityScoreDimensionOrder(left);
    const rightOrder = getQualityScoreDimensionOrder(right);
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });
}

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
 * Uses semantic ctp-* tokens defined in globals.css / tailwind.config.ts.
 */
export function getScoreColor(score: number): { text: string; bg: string } {
  if (score >= 90) {
    return { text: 'text-ctp-green', bg: 'bg-ctp-green/10' };
  }
  if (score >= 70) {
    return { text: 'text-ctp-blue', bg: 'bg-ctp-blue/10' };
  }
  if (score >= 50) {
    return { text: 'text-ctp-yellow', bg: 'bg-ctp-yellow/10' };
  }
  return { text: 'text-ctp-red', bg: 'bg-ctp-red/10' };
}

/**
 * Parses the qualityScoreDetails JSON string into a typed object.
 * Returns null if the input is null, undefined, or invalid JSON.
 */
export function parseQualityScoreDetails(details: string | null | undefined): QualityScoreDetails | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as QualityScoreDetails;

    if (!Array.isArray(parsed.dimensions)) {
      return parsed;
    }

    return {
      ...parsed,
      dimensions: sortQualityScoreDimensions(parsed.dimensions),
    };
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
