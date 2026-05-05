import { prisma } from '@/lib/db/client';
import { AnalysisOutputSchema } from '@/lib/analysis/output-schema';
import { computePairingDeltas } from './compute-deltas';
import { persistPairing } from './persist';
import type { PairingDeltas } from './types';

export interface PairResult {
  paired: boolean;
  reason?: string;
}

function logPhase(ticketId: number, phase: number, result: string, extra?: Record<string, unknown>): void {
  console.log(`[drift-pairing] phase=${phase} result=${result} ticketId=${ticketId}`, extra ?? {});
}

export async function pairAnalysisWithOutcome(ticketId: number): Promise<PairResult> {
  const start = Date.now();

  // Phase 1 — Look up most recent successful analysis
  const analysis = await prisma.ticketAnalysis.findFirst({
    where: { ticketId, status: 'success' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (!analysis) {
    logPhase(ticketId, 1, 'no_analysis');
    return { paired: false, reason: 'no_analysis' };
  }
  logPhase(ticketId, 1, 'found', { analysisId: analysis.id });

  // Phase 2 — Look up outcome
  const outcome = await prisma.ticketOutcome.findUnique({ where: { ticketId } });

  if (!outcome) {
    logPhase(ticketId, 2, 'no_outcome');
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { projectId: true, updatedAt: true },
    });
    if (!ticket) return { paired: false, reason: 'no_ticket' };

    await persistPairing({
      ticketId,
      projectId: ticket.projectId,
      analysisId: analysis.id,
      outcomeId: null,
      shippedAt: ticket.updatedAt,
      deltas: buildIncomparableDeltas(extractFriction(analysis.output) ?? 'low'),
      pendingOutcome: true,
      unpairedReason: null,
    });
    return { paired: false, reason: 'pending_outcome' };
  }
  logPhase(ticketId, 2, 'found', { outcomeId: outcome.id });

  // Phase 3 — Parse analysis output
  const parsed = AnalysisOutputSchema.safeParse(analysis.output);

  if (!parsed.success) {
    logPhase(ticketId, 3, 'output_unparseable');
    await persistPairing({
      ticketId,
      projectId: outcome.projectId,
      analysisId: analysis.id,
      outcomeId: outcome.id,
      shippedAt: outcome.shippedAt,
      deltas: buildIncomparableDeltas('low'),
      pendingOutcome: false,
      unpairedReason: 'output_unparseable',
    });
    return { paired: false, reason: 'output_unparseable' };
  }
  logPhase(ticketId, 3, 'parsed');

  // Phase 4 — Compute deltas
  const deltas = computePairingDeltas(parsed.data, {
    frictionFree: outcome.frictionFree,
    totalCostUsd: outcome.totalCostUsd,
    qualityScore: outcome.qualityScore,
    workflowType: outcome.workflowType,
  });
  logPhase(ticketId, 4, 'computed');

  // Phase 5 — Upsert and mark countedInDrift
  await persistPairing({
    ticketId,
    projectId: outcome.projectId,
    analysisId: analysis.id,
    outcomeId: outcome.id,
    shippedAt: outcome.shippedAt,
    deltas,
    pendingOutcome: false,
    unpairedReason: null,
  });
  logPhase(ticketId, 5, 'persisted', { durationMs: Date.now() - start });

  return { paired: true };
}

function buildIncomparableDeltas(predictedFriction: string): PairingDeltas {
  return {
    predictedFriction,
    actualFrictionFree: false,
    frictionPredictedLow: false,
    frictionMatch: false,
    frictionEmerged: false,
    frictionIncomparable: true,
    predictedCostLowerUsd: null,
    predictedCostUpperUsd: null,
    predictedBaselineUpperUsd: null,
    actualCostUsd: null,
    costInRange: null,
    costMissDirection: null,
    costIncomparable: true,
    predictedQualityLower: null,
    predictedQualityUpper: null,
    actualQualityScore: null,
    qualityInRange: null,
    qualityMissDirection: null,
    qualityIncomparable: true,
    predictedRecommendation: 'FULL',
    actualWorkflowType: 'FULL',
    recommendationMatch: false,
    recommendationIncomparable: true,
  };
}

function extractFriction(output: unknown): string | null {
  if (output && typeof output === 'object' && 'frictionRisk' in output) {
    const v = (output as Record<string, unknown>).frictionRisk;
    if (typeof v === 'string') return v;
  }
  return null;
}
