/**
 * Shared types and constants for the analysis calibration feature (AIB-744).
 *
 * `RULE_SET_VERSION` is pinned to a single integer so historical calibration
 * rows can survive a future change to the binarisation / verdict rules without
 * being silently re-interpreted.
 */
import type { WorkflowType } from '@prisma/client';
import type { PartialReason } from '@/lib/outcomes/types';

export const CALIBRATION_RULE_SET_VERSION = 1 as const;

export const FrictionCellValues = ['TP', 'TN', 'FP', 'FN'] as const;
export type FrictionCell = (typeof FrictionCellValues)[number];

export const VerdictValues = ['hit', 'miss', 'n_a'] as const;
export type Verdict = (typeof VerdictValues)[number];

export type FrictionRating = 'low' | 'medium' | 'high';
export type RecommendationChoice = 'QUICK' | 'FULL';
export type RecommendationConfidence = 'low' | 'medium' | 'high';

export type { PartialReason };

export interface PairedCalibration {
  ticketId: number;
  projectId: number;
  analysisId: number;
  outcomeId: number;

  ruleSetVersion: typeof CALIBRATION_RULE_SET_VERSION;
  shippedAt: Date;

  frictionPredictedRating: FrictionRating;
  frictionPredictedClean: boolean;
  frictionActualFree: boolean;
  frictionCell: FrictionCell;

  qualityPredictedLower: number;
  qualityPredictedUpper: number;
  qualityActual: number | null;
  qualityVerdict: Verdict;

  costPredictedBaselineLowerUsd: number;
  costPredictedBaselineUpperUsd: number;
  costPredictedMarginalLowerUsd: number;
  costPredictedMarginalUpperUsd: number;
  costPredictedSummedLowerUsd: number;
  costPredictedSummedUpperUsd: number;
  costActualUsd: number | null;
  costVerdict: Verdict;

  recommendationPredicted: RecommendationChoice;
  recommendationConfidence: RecommendationConfidence;
  workflowActual: WorkflowType;
  recommendationMatched: boolean;
  recommendationFrictionAligned: boolean;

  partial: boolean;
  partialReason: PartialReason | null;
}

export interface VerdictDistribution {
  hit: number;
  miss: number;
  na: number;
  total: number;
  hitRate: number | null;
}

export interface ConfusionMatrix {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  precisionLowRisk: number | null;
  recallLowRisk: number | null;
  total: number;
}

export interface RecommendationPanelData {
  matchedRate: number | null;
  frictionAlignedRate: number | null;
  counts: {
    matched: number;
    frictionAligned: number;
  };
}

export interface AdoptionData {
  analyzed: number;
  sinceFeatureAvailable: number;
  ratio: number | null;
}

export interface CalibrationDashboardData {
  windowSize: number;
  totalRows: number;
  warmingUp: boolean;
  confusionMatrix: ConfusionMatrix;
  qualityDistribution: VerdictDistribution;
  costDistribution: VerdictDistribution;
  recommendation: RecommendationPanelData;
  adoption: AdoptionData;
  generatedAt: string;
}
