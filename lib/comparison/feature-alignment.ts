/**
 * Feature Alignment Calculator
 *
 * Calculates alignment scores between ticket specifications using
 * weighted dimension comparison (requirements, scenarios, entities, keywords).
 */

import type { FeatureAlignmentScore, SpecSections } from '@/lib/types/comparison';
import { jaccardFromArrays } from './similarity-algorithms';

/**
 * Weights for each dimension in alignment calculation.
 * Total must equal 1.0 (100%).
 */
export const ALIGNMENT_WEIGHTS = {
  requirements: 0.4, // 40% - Functional requirements are strongest indicator
  scenarios: 0.3, // 30% - User scenarios show workflow overlap
  entities: 0.2, // 20% - Data model overlap
  keywords: 0.1, // 10% - General topic similarity
} as const;

/**
 * Minimum alignment score (%) to consider specs as related.
 * Below this threshold, comparison may not be meaningful.
 */
export const ALIGNMENT_THRESHOLD = 30;

/**
 * Calculate dimension score using Jaccard similarity
 *
 * @param arr1 - First array of items
 * @param arr2 - Second array of items
 * @returns Score from 0-100
 */
export function calculateDimensionScore(arr1: string[], arr2: string[]): number {
  // Handle edge cases for empty arrays
  if (arr1.length === 0 && arr2.length === 0) {
    return 100; // Two empty sets are considered identical
  }

  if (arr1.length === 0 || arr2.length === 0) {
    return 0; // One empty set = no overlap
  }

  const similarity = jaccardFromArrays(arr1, arr2);
  return Math.round(similarity * 100);
}

/**
 * Find requirements that appear in both specs
 *
 * @param reqs1 - Requirements from first spec
 * @param reqs2 - Requirements from second spec
 * @returns Array of matching requirement IDs
 */
export function findMatchingRequirements(
  reqs1: string[],
  reqs2: string[]
): string[] {
  const set2 = new Set(reqs2);
  return reqs1.filter((req) => set2.has(req));
}

/**
 * Find entities that appear in both specs
 *
 * @param entities1 - Entities from first spec
 * @param entities2 - Entities from second spec
 * @returns Array of matching entity names
 */
export function findMatchingEntities(
  entities1: string[],
  entities2: string[]
): string[] {
  const set2 = new Set(entities2);
  return entities1.filter((entity) => set2.has(entity));
}

/**
 * Calculate feature alignment score between two specifications
 *
 * @param spec1 - First specification sections
 * @param spec2 - Second specification sections
 * @returns Feature alignment score with breakdown
 */
export function calculateAlignment(
  spec1: SpecSections,
  spec2: SpecSections
): FeatureAlignmentScore {
  // Calculate individual dimension scores
  const dimensions = {
    requirements: calculateDimensionScore(spec1.requirements, spec2.requirements),
    scenarios: calculateDimensionScore(spec1.scenarios, spec2.scenarios),
    entities: calculateDimensionScore(spec1.entities, spec2.entities),
    keywords: calculateDimensionScore(spec1.keywords, spec2.keywords),
  };

  // Calculate weighted overall score
  const overall = Math.round(
    ALIGNMENT_WEIGHTS.requirements * dimensions.requirements +
      ALIGNMENT_WEIGHTS.scenarios * dimensions.scenarios +
      ALIGNMENT_WEIGHTS.entities * dimensions.entities +
      ALIGNMENT_WEIGHTS.keywords * dimensions.keywords
  );

  // Find matching items for detailed reporting
  const matchingRequirements = findMatchingRequirements(
    spec1.requirements,
    spec2.requirements
  );
  const matchingEntities = findMatchingEntities(spec1.entities, spec2.entities);

  return {
    overall,
    dimensions,
    isAligned: overall >= ALIGNMENT_THRESHOLD,
    matchingRequirements,
    matchingEntities,
  };
}

/**
 * Compare multiple specs against a source spec
 *
 * @param sourceSpec - Source specification
 * @param targetSpecs - Array of target specifications to compare
 * @returns Array of alignment scores
 */
export function compareMultipleSpecs(
  sourceSpec: SpecSections,
  targetSpecs: SpecSections[]
): FeatureAlignmentScore[] {
  return targetSpecs.map((target) => calculateAlignment(sourceSpec, target));
}

/**
 * Calculate average alignment across multiple comparisons
 *
 * @param scores - Array of alignment scores
 * @returns Average overall score
 */
export function calculateAverageAlignment(
  scores: FeatureAlignmentScore[]
): number {
  if (scores.length === 0) return 0;

  const sum = scores.reduce((acc, score) => acc + score.overall, 0);
  return Math.round(sum / scores.length);
}

/**
 * Determine if a comparison is meaningful based on alignment
 *
 * @param score - Alignment score
 * @returns True if comparison is meaningful
 */
export function isComparisonMeaningful(score: FeatureAlignmentScore): boolean {
  return score.isAligned;
}

/**
 * Get alignment level description
 *
 * @param score - Overall alignment score (0-100)
 * @returns Human-readable alignment level
 */
export function getAlignmentLevel(
  score: number
): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'none';
}

/**
 * Generate alignment summary text
 *
 * @param score - Feature alignment score
 * @returns Human-readable summary
 */
export function generateAlignmentSummary(score: FeatureAlignmentScore): string {
  const level = getAlignmentLevel(score.overall);

  const summaries: Record<typeof level, string> = {
    high: `High alignment (${score.overall}%): These tickets share significant feature overlap and are highly comparable.`,
    medium: `Medium alignment (${score.overall}%): These tickets have moderate overlap and may benefit from comparison.`,
    low: `Low alignment (${score.overall}%): These tickets have limited overlap. Comparison results may be less meaningful.`,
    none: `Minimal alignment (${score.overall}%): These tickets appear unrelated. Consider if comparison is warranted.`,
  };

  let summary = summaries[level];

  if (score.matchingRequirements.length > 0) {
    summary += ` Matching requirements: ${score.matchingRequirements.join(', ')}.`;
  }

  if (score.matchingEntities.length > 0) {
    summary += ` Shared entities: ${score.matchingEntities.join(', ')}.`;
  }

  return summary;
}
