/**
 * Pure derivation helpers for analysis calibration.
 *
 * Every helper is a function from spec inputs to spec-defined outputs with no
 * I/O. They are unit tested in `tests/unit/calibration/derive.test.ts`.
 */
import type { WorkflowType } from '@prisma/client';
import type {
  FrictionCell,
  FrictionRating,
  RecommendationChoice,
  Verdict,
} from './types';

export function binariseFriction(rating: FrictionRating): boolean {
  return rating === 'low';
}

export function classifyFrictionCell(
  predictedClean: boolean,
  actualFree: boolean
): FrictionCell {
  if (predictedClean && actualFree) return 'TP';
  if (!predictedClean && !actualFree) return 'TN';
  if (predictedClean && !actualFree) return 'FP';
  return 'FN';
}

export function quantifyQualityVerdict(
  actual: number | null,
  lower: number,
  upper: number
): Verdict {
  if (actual === null) return 'n_a';
  if (actual >= lower && actual <= upper) return 'hit';
  return 'miss';
}

export function quantifyCostVerdict(
  actual: number | null,
  summedLower: number,
  summedUpper: number
): Verdict {
  if (actual === null) return 'n_a';
  if (actual >= summedLower && actual <= summedUpper) return 'hit';
  return 'miss';
}

export interface RecommendationAxes {
  matched: boolean;
  frictionAligned: boolean;
}

export function computeRecommendationAxes(
  predictedChoice: RecommendationChoice,
  actualWorkflowType: WorkflowType,
  frictionFree: boolean
): RecommendationAxes {
  const matched = (predictedChoice as string) === (actualWorkflowType as string);
  const frictionAligned =
    (predictedChoice === 'QUICK' && frictionFree) ||
    (predictedChoice === 'FULL' && !frictionFree);
  return { matched, frictionAligned };
}

export interface CostBounds {
  baselineLower: number;
  baselineUpper: number;
  marginalLower: number;
  marginalUpper: number;
}

export interface CostSummedRange {
  lower: number;
  upper: number;
}

export function sumCostRange(bounds: CostBounds): CostSummedRange {
  return {
    lower: bounds.baselineLower + bounds.marginalLower,
    upper: bounds.baselineUpper + bounds.marginalUpper,
  };
}
