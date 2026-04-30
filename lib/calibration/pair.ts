/**
 * Calibration pairing orchestrator. Phases follow workflows/pair-on-outcome.md.
 *
 * Triggered from `lib/tickets/transition.ts` after `captureOutcomeOnShip`
 * resolves with status 'created' | 'duplicate'. Pure DB join — no LLM, no
 * cross-repo I/O.
 */
import { prisma } from '@/lib/db/client';
import { AnalysisOutputSchema } from '@/lib/analysis/output-schema';
import {
  binariseFriction,
  classifyFrictionCell,
  computeRecommendationAxes,
  quantifyCostVerdict,
  quantifyQualityVerdict,
  sumCostRange,
} from './derive';
import { persistCalibration } from './persist';
import {
  CALIBRATION_RULE_SET_VERSION,
  type FrictionRating,
  type PairedCalibration,
  type PartialReason,
  type RecommendationChoice,
  type RecommendationConfidence,
} from './types';

export interface PairCalibrationInput {
  ticketId: number;
  projectId: number;
}

export type PairCalibrationStatus =
  | 'created'
  | 'duplicate'
  | 'no_outcome'
  | 'no_success_analysis'
  | 'invalid_analysis_output';

export interface PairCalibrationResult {
  status: PairCalibrationStatus;
}

function logPhase(ticketId: number, phase: number, durationMs: number, extra?: Record<string, unknown>): void {
  console.log(
    `[calibration] phase=${phase} ticketId=${ticketId} durationMs=${durationMs}`,
    extra ?? {}
  );
}

export async function pairCalibrationOnOutcome(
  input: PairCalibrationInput
): Promise<PairCalibrationResult> {
  const { ticketId, projectId } = input;
  const t0 = Date.now();

  // Phase 1: Idempotency check
  const existing = await prisma.analysisCalibration.findUnique({
    where: { ticketId },
  });
  if (existing) {
    logPhase(ticketId, 1, Date.now() - t0, { skipped: 'duplicate' });
    return { status: 'duplicate' };
  }
  const t1 = Date.now();
  logPhase(ticketId, 1, t1 - t0);

  // Phase 2: Fetch the paired outcome
  const outcome = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
  if (!outcome) {
    console.warn('[calibration] outcome missing at pair time', { ticketId });
    return { status: 'no_outcome' };
  }
  const t2 = Date.now();
  logPhase(ticketId, 2, t2 - t1, { outcomeId: outcome.id });

  // Phase 3: Fetch the latest success analysis
  const analysis = await prisma.ticketAnalysis.findFirst({
    where: { ticketId, status: 'success' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, output: true, createdAt: true },
  });
  if (!analysis) {
    return { status: 'no_success_analysis' };
  }
  const t3 = Date.now();
  logPhase(ticketId, 3, t3 - t2, { analysisId: analysis.id });

  // Phase 4: Parse predicted output
  const parsed = AnalysisOutputSchema.safeParse(analysis.output);
  if (!parsed.success) {
    console.error('[calibration] invalid analysis output', {
      ticketId,
      analysisId: analysis.id,
      issues: parsed.error.issues,
    });
    return { status: 'invalid_analysis_output' };
  }
  const predicted = parsed.data;
  const t4 = Date.now();
  logPhase(ticketId, 4, t4 - t3);

  // Phase 5: Friction pairing
  const frictionPredictedRating = predicted.frictionRisk as FrictionRating;
  const frictionPredictedClean = binariseFriction(frictionPredictedRating);
  const frictionActualFree = outcome.frictionFree;
  const frictionCell = classifyFrictionCell(frictionPredictedClean, frictionActualFree);

  // Phase 6: Quality pairing
  const qualityVerdict = quantifyQualityVerdict(
    outcome.qualityScore,
    predicted.qualityGateRange.lower,
    predicted.qualityGateRange.upper
  );

  // Phase 7: Cost pairing
  const summed = sumCostRange({
    baselineLower: predicted.costRange.baselineLowerUsd,
    baselineUpper: predicted.costRange.baselineUpperUsd,
    marginalLower: predicted.costRange.marginalFrictionLowerUsd,
    marginalUpper: predicted.costRange.marginalFrictionUpperUsd,
  });
  const costVerdict = quantifyCostVerdict(outcome.totalCostUsd, summed.lower, summed.upper);

  // Phase 8: Recommendation pairing
  const recommendationPredicted = predicted.recommendation.choice as RecommendationChoice;
  const axes = computeRecommendationAxes(
    recommendationPredicted,
    outcome.workflowType,
    frictionActualFree
  );

  // Phase 9: Persist
  const paired: PairedCalibration = {
    ticketId,
    projectId,
    analysisId: analysis.id,
    outcomeId: outcome.id,
    ruleSetVersion: CALIBRATION_RULE_SET_VERSION,
    shippedAt: outcome.shippedAt,

    frictionPredictedRating,
    frictionPredictedClean,
    frictionActualFree,
    frictionCell,

    qualityPredictedLower: predicted.qualityGateRange.lower,
    qualityPredictedUpper: predicted.qualityGateRange.upper,
    qualityActual: outcome.qualityScore,
    qualityVerdict,

    costPredictedBaselineLowerUsd: predicted.costRange.baselineLowerUsd,
    costPredictedBaselineUpperUsd: predicted.costRange.baselineUpperUsd,
    costPredictedMarginalLowerUsd: predicted.costRange.marginalFrictionLowerUsd,
    costPredictedMarginalUpperUsd: predicted.costRange.marginalFrictionUpperUsd,
    costPredictedSummedLowerUsd: summed.lower,
    costPredictedSummedUpperUsd: summed.upper,
    costActualUsd: outcome.totalCostUsd,
    costVerdict,

    recommendationPredicted,
    recommendationConfidence: predicted.recommendation.confidence as RecommendationConfidence,
    workflowActual: outcome.workflowType,
    recommendationMatched: axes.matched,
    recommendationFrictionAligned: axes.frictionAligned,

    partial: outcome.partial,
    partialReason: (outcome.partialReason as PartialReason | null) ?? null,
  };

  const result = await persistCalibration(paired);
  const totalMs = Date.now() - t0;
  logPhase(ticketId, 9, totalMs, {
    created: result.created,
    analysisId: analysis.id,
    outcomeId: outcome.id,
  });
  if (result.created) {
    console.log(
      `[calibration] success ticketId=${ticketId} analysisId=${analysis.id} outcomeId=${outcome.id}`
    );
    return { status: 'created' };
  }
  return { status: 'duplicate' };
}
