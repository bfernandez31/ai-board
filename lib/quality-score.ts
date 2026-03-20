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

export interface DimensionConfig {
  agentId: string;
  name: string;
  weight: number;
  order: number;
}

/** Single source of truth for all code review dimensions */
export const DIMENSION_CONFIG: DimensionConfig[] = [
  { agentId: 'compliance', name: 'Compliance', weight: 0.40, order: 1 },
  { agentId: 'bug-detection', name: 'Bug Detection', weight: 0.30, order: 2 },
  { agentId: 'code-comments', name: 'Code Comments', weight: 0.20, order: 3 },
  { agentId: 'historical-context', name: 'Historical Context', weight: 0.10, order: 4 },
  { agentId: 'spec-sync', name: 'Spec Sync', weight: 0.00, order: 5 },
];

/** Derived dimension weights for backward compatibility */
export const DIMENSION_WEIGHTS: Record<string, number> = Object.fromEntries(
  DIMENSION_CONFIG.map(d => [d.agentId, d.weight])
);

export function getDimensionName(agentId: string): string {
  return DIMENSION_CONFIG.find(d => d.agentId === agentId)?.name ?? agentId;
}

export function getDimensionWeight(agentId: string): number {
  return DIMENSION_CONFIG.find(d => d.agentId === agentId)?.weight ?? 0;
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
  const total = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  return Math.round(total);
}
