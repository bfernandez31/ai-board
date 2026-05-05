import type { AnalysisOutput } from '@/lib/analysis/output-schema';
import type { PairingDeltas } from './types';

interface OutcomeInput {
  frictionFree: boolean;
  totalCostUsd: number | null;
  qualityScore: number | null;
  workflowType: string;
}

export function computePairingDeltas(
  prediction: AnalysisOutput,
  outcome: OutcomeInput
): PairingDeltas {
  // Friction
  const predictedLow = prediction.frictionRisk === 'low';
  const actualLow = outcome.frictionFree === true;
  const frictionMatch = predictedLow === actualLow;
  const frictionEmerged = !outcome.frictionFree;

  // Cost: envelope = [baselineLowerUsd, marginalFrictionUpperUsd]
  const costLower = prediction.costRange.baselineLowerUsd;
  const costUpper = prediction.costRange.marginalFrictionUpperUsd;
  const actualCost = outcome.totalCostUsd;
  const costIncomparable = actualCost === null;
  const costInRange = costIncomparable ? null : actualCost >= costLower && actualCost <= costUpper;
  const costMissDirection = costIncomparable
    ? null
    : actualCost! < costLower
      ? 'under'
      : actualCost! > costUpper
        ? 'over'
        : null;

  // Quality
  const qLower = prediction.qualityGateRange.lower;
  const qUpper = prediction.qualityGateRange.upper;
  const actualQ = outcome.qualityScore;
  const qualityIncomparable = actualQ === null;
  const qualityInRange = qualityIncomparable ? null : actualQ >= qLower && actualQ <= qUpper;
  const qualityMissDirection = qualityIncomparable
    ? null
    : actualQ! < qLower
      ? 'under'
      : actualQ! > qUpper
        ? 'over'
        : null;

  // Workflow recommendation
  const predictedRec = prediction.recommendation.choice;
  const actualWf = outcome.workflowType;
  const recommendationMatch = predictedRec === actualWf;

  return {
    predictedFriction: prediction.frictionRisk,
    actualFrictionFree: outcome.frictionFree,
    frictionPredictedLow: predictedLow,
    frictionMatch,
    frictionEmerged,
    frictionIncomparable: false,
    predictedCostLowerUsd: costLower,
    predictedCostUpperUsd: costUpper,
    predictedBaselineUpperUsd: prediction.costRange.baselineUpperUsd,
    actualCostUsd: actualCost,
    costInRange,
    costMissDirection,
    costIncomparable,
    predictedQualityLower: qLower,
    predictedQualityUpper: qUpper,
    actualQualityScore: actualQ,
    qualityInRange,
    qualityMissDirection,
    qualityIncomparable,
    predictedRecommendation: predictedRec,
    actualWorkflowType: actualWf,
    recommendationMatch,
    recommendationIncomparable: false,
  };
}
