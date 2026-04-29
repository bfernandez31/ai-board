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
  { agentId: 'compliance', name: 'Compliance', weight: 0.30, order: 1 },
  { agentId: 'bug-detection', name: 'Bug Detection', weight: 0.30, order: 2 },
  { agentId: 'product-contract-sync', name: 'Product Contract Sync', weight: 0.20, order: 3 },
  { agentId: 'edge-cases-failure-modes', name: 'Edge Cases & Failure Modes', weight: 0.15, order: 4 },
  { agentId: 'historical-context', name: 'Historical Context', weight: 0.05, order: 5 },
];

const LEGACY_DIMENSION_AGENT_ALIASES: Record<string, string> = {
  'spec-sync': 'product-contract-sync',
  'code-comments': 'edge-cases-failure-modes',
};

const DIMENSION_NAME_TO_AGENT_ID: Record<string, string> = {
  'Compliance': 'compliance',
  'Bug Detection': 'bug-detection',
  'Product Contract Sync': 'product-contract-sync',
  'Edge Cases & Failure Modes': 'edge-cases-failure-modes',
  'Historical Context': 'historical-context',
  'Spec Sync': 'spec-sync',
  'Code Comments': 'code-comments',
  'PR Comments': 'pr-comments',
};

/** Derived dimension weights for backward compatibility */
export const DIMENSION_WEIGHTS: Record<string, number> = Object.fromEntries(
  DIMENSION_CONFIG.map(d => [d.agentId, d.weight])
);

export function normalizeDimensionAgentId(agentId: string): string {
  return LEGACY_DIMENSION_AGENT_ALIASES[agentId] ?? agentId;
}

export function inferDimensionAgentId(name: string): string | null {
  return DIMENSION_NAME_TO_AGENT_ID[name] ?? null;
}

export function getDimensionName(agentId: string): string {
  const normalizedAgentId = normalizeDimensionAgentId(agentId);
  return DIMENSION_CONFIG.find(d => d.agentId === normalizedAgentId)?.name ?? agentId;
}

export function getDimensionWeight(agentId: string): number {
  const normalizedAgentId = normalizeDimensionAgentId(agentId);
  return DIMENSION_CONFIG.find(d => d.agentId === normalizedAgentId)?.weight ?? 0;
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
 * Returns the Badge attribute level for a given score, aligned with the
 * 4-tier quality rampe (`<Badge variant="attribute" kind="quality" />`).
 * Single source of truth for both ticket quality and project health.
 *
 * Thresholds match getScoreThreshold:
 *   90-100 (Excellent) → 'best'  (green)
 *   70-89  (Good)      → 'high'  (blue)
 *   50-69  (Fair)      → 'med'   (yellow)
 *   0-49   (Poor)      → 'low'   (red)
 *
 * Returns null for null score (no data).
 */
export function getScoreLevel(
  score: number | null
): 'best' | 'high' | 'med' | 'low' | null {
  if (score === null) return null;
  if (score >= 90) return 'best';
  if (score >= 70) return 'high';
  if (score >= 50) return 'med';
  return 'low';
}

/**
 * Returns Tailwind CSS classes for the score's threshold color.
 * Uses semantic ctp-* tokens defined in globals.css / tailwind.config.ts.
 */
export function getScoreColor(score: number): { text: string; bg: string; fill: string } {
  if (score >= 90) {
    return { text: 'text-ctp-green', bg: 'bg-ctp-green/10', fill: 'bg-ctp-green' };
  }
  if (score >= 70) {
    return { text: 'text-ctp-blue', bg: 'bg-ctp-blue/10', fill: 'bg-ctp-blue' };
  }
  if (score >= 50) {
    return { text: 'text-ctp-yellow', bg: 'bg-ctp-yellow/10', fill: 'bg-ctp-yellow' };
  }
  return { text: 'text-ctp-red', bg: 'bg-ctp-red/10', fill: 'bg-ctp-red' };
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
