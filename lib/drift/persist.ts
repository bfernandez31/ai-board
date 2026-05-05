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

  const shared = {
    analysisId,
    outcomeId,
    pendingOutcome,
    unpairedReason,
    predictedFriction: deltas.predictedFriction,
    actualFrictionFree: deltas.actualFrictionFree,
    frictionPredictedLow: deltas.frictionPredictedLow,
    frictionMatch: deltas.frictionMatch,
    frictionEmerged: deltas.frictionEmerged,
    frictionIncomparable: deltas.frictionIncomparable,
    predictedCostLowerUsd: deltas.predictedCostLowerUsd,
    predictedCostUpperUsd: deltas.predictedCostUpperUsd,
    predictedBaselineUpperUsd: deltas.predictedBaselineUpperUsd,
    actualCostUsd: deltas.actualCostUsd,
    costInRange: deltas.costInRange,
    costMissDirection: deltas.costMissDirection,
    costIncomparable: deltas.costIncomparable,
    predictedQualityLower: deltas.predictedQualityLower,
    predictedQualityUpper: deltas.predictedQualityUpper,
    actualQualityScore: deltas.actualQualityScore,
    qualityInRange: deltas.qualityInRange,
    qualityMissDirection: deltas.qualityMissDirection,
    qualityIncomparable: deltas.qualityIncomparable,
    predictedRecommendation: deltas.predictedRecommendation,
    actualWorkflowType: deltas.actualWorkflowType,
    recommendationMatch: deltas.recommendationMatch,
    recommendationIncomparable: deltas.recommendationIncomparable,
  };

  const data: Prisma.AnalysisOutcomePairingUncheckedCreateInput = {
    ticketId,
    projectId,
    shippedAt,
    ...shared,
  };

  await prisma.$transaction(async (tx) => {
    await tx.analysisOutcomePairing.upsert({
      where: { ticketId },
      create: data,
      update: shared,
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
