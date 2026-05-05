import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { PairingDeltas } from './types';

export interface PersistPairingInput {
  ticketId: number;
  projectId: number;
  analysisId: number;
  outcomeId: number | null;
  shippedAt: Date;
  deltas: PairingDeltas;
  pendingOutcome: boolean;
  unpairedReason: string | null;
}

export async function persistPairing(input: PersistPairingInput): Promise<void> {
  const {
    ticketId,
    projectId,
    analysisId,
    outcomeId,
    shippedAt,
    deltas,
    pendingOutcome,
    unpairedReason,
  } = input;

  const data: Prisma.AnalysisOutcomePairingUncheckedCreateInput = {
    ticketId,
    projectId,
    analysisId,
    outcomeId: outcomeId ?? null,
    shippedAt,
    pendingOutcome,
    unpairedReason,
    predictedFriction: deltas.predictedFriction,
    actualFrictionFree: deltas.actualFrictionFree,
    frictionPredictedLow: deltas.frictionPredictedLow,
    frictionMatch: deltas.frictionMatch,
    frictionEmerged: deltas.frictionEmerged,
    frictionIncomparable: deltas.frictionIncomparable,
    predictedCostLowerUsd: deltas.predictedCostLowerUsd ?? null,
    predictedCostUpperUsd: deltas.predictedCostUpperUsd ?? null,
    predictedBaselineUpperUsd: deltas.predictedBaselineUpperUsd ?? null,
    actualCostUsd: deltas.actualCostUsd ?? null,
    costInRange: deltas.costInRange ?? null,
    costMissDirection: deltas.costMissDirection ?? null,
    costIncomparable: deltas.costIncomparable,
    predictedQualityLower: deltas.predictedQualityLower ?? null,
    predictedQualityUpper: deltas.predictedQualityUpper ?? null,
    actualQualityScore: deltas.actualQualityScore ?? null,
    qualityInRange: deltas.qualityInRange ?? null,
    qualityMissDirection: deltas.qualityMissDirection ?? null,
    qualityIncomparable: deltas.qualityIncomparable,
    predictedRecommendation: deltas.predictedRecommendation,
    actualWorkflowType: deltas.actualWorkflowType,
    recommendationMatch: deltas.recommendationMatch,
    recommendationIncomparable: deltas.recommendationIncomparable,
  };

  const updateData: Prisma.AnalysisOutcomePairingUncheckedUpdateInput = {
    analysisId,
    outcomeId: outcomeId ?? null,
    pendingOutcome,
    unpairedReason,
    predictedFriction: deltas.predictedFriction,
    actualFrictionFree: deltas.actualFrictionFree,
    frictionPredictedLow: deltas.frictionPredictedLow,
    frictionMatch: deltas.frictionMatch,
    frictionEmerged: deltas.frictionEmerged,
    frictionIncomparable: deltas.frictionIncomparable,
    predictedCostLowerUsd: deltas.predictedCostLowerUsd ?? null,
    predictedCostUpperUsd: deltas.predictedCostUpperUsd ?? null,
    predictedBaselineUpperUsd: deltas.predictedBaselineUpperUsd ?? null,
    actualCostUsd: deltas.actualCostUsd ?? null,
    costInRange: deltas.costInRange ?? null,
    costMissDirection: deltas.costMissDirection ?? null,
    costIncomparable: deltas.costIncomparable,
    predictedQualityLower: deltas.predictedQualityLower ?? null,
    predictedQualityUpper: deltas.predictedQualityUpper ?? null,
    actualQualityScore: deltas.actualQualityScore ?? null,
    qualityInRange: deltas.qualityInRange ?? null,
    qualityMissDirection: deltas.qualityMissDirection ?? null,
    qualityIncomparable: deltas.qualityIncomparable,
    predictedRecommendation: deltas.predictedRecommendation,
    actualWorkflowType: deltas.actualWorkflowType,
    recommendationMatch: deltas.recommendationMatch,
    recommendationIncomparable: deltas.recommendationIncomparable,
  };

  await prisma.$transaction(async (tx) => {
    await tx.analysisOutcomePairing.upsert({
      where: { ticketId },
      create: data,
      update: updateData,
    });

    // Set countedInDrift=false on all other analyses for this ticket
    await tx.ticketAnalysis.updateMany({
      where: { ticketId, NOT: { id: analysisId } },
      data: { countedInDrift: false },
    });
    // Set countedInDrift=true on the chosen analysis
    await tx.ticketAnalysis.update({
      where: { id: analysisId },
      data: { countedInDrift: true },
    });
  });
}
