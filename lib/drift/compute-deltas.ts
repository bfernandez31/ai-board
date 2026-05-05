import type { AnalysisOutput } from '@/lib/analysis/output-schema';
import type { PairingDeltas } from './types';

interface OutcomeInput {
  frictionFree: boolean;
  totalCostUsd: number | null;
  qualityScore: number | null;
  workflowType: string;
}

function missDirection(actual: number, lower: number, upper: number): 'under' | 'over' | null {
  if (actual < lower) return 'under';
  if (actual > upper) return 'over';
  return null;
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
  const costInRange = actualCost === null ? null : actualCost >= costLower && actualCost <= costUpper;
  const costMissDirection = actualCost === null ? null : missDirection(actualCost, costLower, costUpper);

  // Quality
  const qLower = prediction.qualityGateRange.lower;
  const qUpper = prediction.qualityGateRange.upper;
  const actualQ = outcome.qualityScore;
  const qualityIncomparable = actualQ === null;
  const qualityInRange = actualQ === null ? null : actualQ >= qLower && actualQ <= qUpper;
  const qualityMissDirection = actualQ === null ? null : missDirection(actualQ, qLower, qUpper);

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
