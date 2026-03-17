/**
 * Quality Score Utilities
 *
 * Helpers for computing, classifying, and displaying quality scores.
 * Thresholds: Excellent (90+), Good (70-89), Fair (50-69), Poor (<50)
 */

export type QualityTier = 'excellent' | 'good' | 'fair' | 'poor';

export interface QualityTierConfig {
  tier: QualityTier;
  label: string;
  /** Tailwind text color class */
  textColor: string;
  /** Tailwind background color class */
  bgColor: string;
  /** Tailwind border color class */
  borderColor: string;
}

const TIER_CONFIGS: Record<QualityTier, QualityTierConfig> = {
  excellent: {
    tier: 'excellent',
    label: 'Excellent',
    textColor: 'text-ctp-green',
    bgColor: 'bg-ctp-green/10',
    borderColor: 'border-ctp-green/30',
  },
  good: {
    tier: 'good',
    label: 'Good',
    textColor: 'text-ctp-blue',
    bgColor: 'bg-ctp-blue/10',
    borderColor: 'border-ctp-blue/30',
  },
  fair: {
    tier: 'fair',
    label: 'Fair',
    textColor: 'text-ctp-peach',
    bgColor: 'bg-ctp-peach/10',
    borderColor: 'border-ctp-peach/30',
  },
  poor: {
    tier: 'poor',
    label: 'Poor',
    textColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
  },
};

/**
 * Get the quality tier for a score (0-100)
 */
export function getQualityTier(score: number): QualityTier {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Get the full tier configuration for a score
 */
export function getQualityTierConfig(score: number): QualityTierConfig {
  return TIER_CONFIGS[getQualityTier(score)];
}

/**
 * Quality score dimension weights
 */
export const QUALITY_DIMENSIONS = {
  compliance: { label: 'Compliance', weight: 30 },
  bugDetection: { label: 'Bug Detection', weight: 30 },
  codeComments: { label: 'Code Comments', weight: 20 },
  historicalContext: { label: 'Historical Context', weight: 10 },
  previousPrComments: { label: 'PR Comments', weight: 10 },
} as const;
