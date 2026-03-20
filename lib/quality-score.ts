/**
 * Quality Score Utilities
 *
 * Shared types and helper functions for quality score display and computation.
 * Quality scores are computed by code review agents during VERIFY workflow
 * and stored on the Job model as an integer (0-100) with JSON dimension details.
 */

export type ScoreThreshold = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface ReviewDimensionFinding {
  type: 'contradiction' | 'coverage-gap';
  specFilePath: string;
  summary: string;
  evidence?: string;
}

export interface DimensionScore {
  name: string;
  agentId: string;
  score: number;
  weight: number;
  weightedScore: number;
  findings?: ReviewDimensionFinding[];
}

export interface QualityScoreDetails {
  version?: number;
  qualityScore?: number;
  dimensions: DimensionScore[];
  threshold: ScoreThreshold;
  computedAt: string;
}

export interface ReviewDimensionConfig {
  key: 'bug-detection' | 'compliance' | 'code-comments' | 'historical-context' | 'spec-sync';
  agentId: string;
  name: string;
  weight: number;
  affectsOverallScore: boolean;
  displayOrder: number;
}

export const REVIEW_DIMENSIONS = [
  {
    key: 'bug-detection',
    agentId: 'bug-detection',
    name: 'Bug Detection',
    weight: 0.3,
    affectsOverallScore: true,
    displayOrder: 1,
  },
  {
    key: 'compliance',
    agentId: 'compliance',
    name: 'Compliance',
    weight: 0.4,
    affectsOverallScore: true,
    displayOrder: 2,
  },
  {
    key: 'code-comments',
    agentId: 'code-comments',
    name: 'Code Comments',
    weight: 0.2,
    affectsOverallScore: true,
    displayOrder: 3,
  },
  {
    key: 'historical-context',
    agentId: 'historical-context',
    name: 'Historical Context',
    weight: 0.1,
    affectsOverallScore: true,
    displayOrder: 4,
  },
  {
    key: 'spec-sync',
    agentId: 'spec-sync',
    name: 'Spec Sync',
    weight: 0,
    affectsOverallScore: false,
    displayOrder: 5,
  },
] as const satisfies readonly ReviewDimensionConfig[];

export const LEGACY_REVIEW_DIMENSIONS = [
  {
    key: 'pr-comments',
    agentId: 'pr-comments',
    name: 'PR Comments',
    weight: 0.1,
    affectsOverallScore: true,
    displayOrder: 5,
  },
] as const;

type ReviewDimensionLookup = Pick<
  ReviewDimensionConfig,
  'agentId' | 'name' | 'weight' | 'affectsOverallScore' | 'displayOrder'
>;

const REVIEW_DIMENSION_LOOKUP = new Map<string, ReviewDimensionLookup>(
  [...REVIEW_DIMENSIONS, ...LEGACY_REVIEW_DIMENSIONS].flatMap((dimension) => [
    [dimension.agentId, dimension],
    [dimension.name, dimension],
  ])
);

export function getReviewDimensionConfig(
  dimension: Pick<DimensionScore, 'agentId' | 'name'> | string
): ReviewDimensionLookup | null {
  if (typeof dimension === 'string') {
    return REVIEW_DIMENSION_LOOKUP.get(dimension) ?? null;
  }

  return (
    REVIEW_DIMENSION_LOOKUP.get(dimension.agentId) ??
    REVIEW_DIMENSION_LOOKUP.get(dimension.name) ??
    null
  );
}

export function getDimensionDisplayOrder(
  dimension: Pick<DimensionScore, 'agentId' | 'name'>
): number {
  return getReviewDimensionConfig(dimension)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
}

export function sortDimensionsForDisplay<T extends Pick<DimensionScore, 'agentId' | 'name'>>(
  dimensions: T[]
): T[] {
  return [...dimensions].sort((left, right) => {
    const orderDiff = getDimensionDisplayOrder(left) - getDimensionDisplayOrder(right);
    if (orderDiff !== 0) return orderDiff;

    return left.name.localeCompare(right.name);
  });
}

export function normalizeDimensionForDisplay<T extends DimensionScore>(dimension: T): T {
  const config = getReviewDimensionConfig(dimension);
  if (!config) {
    return dimension;
  }

  return {
    ...dimension,
    agentId: config.agentId,
    name: config.name,
    weight: config.weight,
    weightedScore: dimension.score * config.weight,
  };
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
  const total = dimensions.reduce((sum, dimension) => {
    const config = getReviewDimensionConfig(dimension);
    const affectsOverallScore = config?.affectsOverallScore ?? dimension.weight > 0;

    if (!affectsOverallScore) {
      return sum;
    }

    return sum + dimension.score * dimension.weight;
  }, 0);

  return Math.round(total);
}
