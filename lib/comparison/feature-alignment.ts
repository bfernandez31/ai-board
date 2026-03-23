import type { FeatureAlignmentScore, SpecSections } from '@/lib/types/comparison';
import { jaccardFromArrays } from './similarity-algorithms';

/** Weights for each dimension (total = 1.0) */
export const ALIGNMENT_WEIGHTS = {
  requirements: 0.4, // 40% - Functional requirements are strongest indicator
  scenarios: 0.3, // 30% - User scenarios show workflow overlap
  entities: 0.2, // 20% - Data model overlap
  keywords: 0.1, // 10% - General topic similarity
} as const;

/** Minimum alignment score (%) to consider specs as related */
export const ALIGNMENT_THRESHOLD = 30;

export function calculateDimensionScore(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 && arr2.length === 0) return 100;
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const similarity = jaccardFromArrays(arr1, arr2);
  return Math.round(similarity * 100);
}

export function findMatchingRequirements(
  reqs1: string[],
  reqs2: string[]
): string[] {
  const set2 = new Set(reqs2);
  return reqs1.filter((req) => set2.has(req));
}

export function findMatchingEntities(
  entities1: string[],
  entities2: string[]
): string[] {
  const set2 = new Set(entities2);
  return entities1.filter((entity) => set2.has(entity));
}

export function calculateAlignment(
  spec1: SpecSections,
  spec2: SpecSections
): FeatureAlignmentScore {
  const dimensions = {
    requirements: calculateDimensionScore(spec1.requirements, spec2.requirements),
    scenarios: calculateDimensionScore(spec1.scenarios, spec2.scenarios),
    entities: calculateDimensionScore(spec1.entities, spec2.entities),
    keywords: calculateDimensionScore(spec1.keywords, spec2.keywords),
  };

  const overall = Math.round(
    ALIGNMENT_WEIGHTS.requirements * dimensions.requirements +
      ALIGNMENT_WEIGHTS.scenarios * dimensions.scenarios +
      ALIGNMENT_WEIGHTS.entities * dimensions.entities +
      ALIGNMENT_WEIGHTS.keywords * dimensions.keywords
  );

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

export function getAlignmentLevel(
  score: number
): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'none';
}

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
