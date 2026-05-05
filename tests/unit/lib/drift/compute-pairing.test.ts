/**
 * Unit tests for computePairingDeltas — pure function, no DB.
 */

import { describe, expect, it } from 'vitest';
import { computePairingDeltas } from '@/lib/drift/compute-deltas';
import type { AnalysisOutput } from '@/lib/analysis/output-schema';

const basePrediction: AnalysisOutput = {
  frictionRisk: 'low',
  qualityGateRange: { lower: 70, upper: 90 },
  recommendation: { choice: 'FULL', confidence: 'high', justification: 'standard' },
  costRange: {
    baselineLowerUsd: 1.0,
    baselineUpperUsd: 3.0,
    marginalFrictionLowerUsd: 3.0,
    marginalFrictionUpperUsd: 5.0,
  },
  scopeWarnings: [],
  anchors: [],
};

const baseOutcome = {
  frictionFree: true,
  totalCostUsd: 2.5,
  qualityScore: 80,
  workflowType: 'FULL' as const,
};

describe('computePairingDeltas — friction binarization', () => {
  it('TP: predicted low, actual frictionFree=true', () => {
    const d = computePairingDeltas(basePrediction, baseOutcome);
    expect(d.frictionPredictedLow).toBe(true);
    expect(d.frictionMatch).toBe(true);
    expect(d.frictionEmerged).toBe(false);
    expect(d.frictionIncomparable).toBe(false);
    expect(d.predictedFriction).toBe('low');
  });

  it('FN: predicted low, actual frictionFree=false', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, frictionFree: false });
    expect(d.frictionPredictedLow).toBe(true);
    expect(d.frictionMatch).toBe(false);
    expect(d.frictionEmerged).toBe(true);
  });

  it('FP: predicted medium, actual frictionFree=true', () => {
    const d = computePairingDeltas(
      { ...basePrediction, frictionRisk: 'medium' },
      { ...baseOutcome, frictionFree: true }
    );
    expect(d.frictionPredictedLow).toBe(false);
    expect(d.frictionMatch).toBe(false);
    expect(d.frictionEmerged).toBe(false);
  });

  it('TN: predicted high, actual frictionFree=false', () => {
    const d = computePairingDeltas(
      { ...basePrediction, frictionRisk: 'high' },
      { ...baseOutcome, frictionFree: false }
    );
    expect(d.frictionPredictedLow).toBe(false);
    expect(d.frictionMatch).toBe(true);
    expect(d.frictionEmerged).toBe(true);
  });
});

describe('computePairingDeltas — cost range', () => {
  it('inRange: actual inside [baselineLower, marginalUpper]', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: 2.5 });
    expect(d.costInRange).toBe(true);
    expect(d.costMissDirection).toBeNull();
    expect(d.costIncomparable).toBe(false);
  });

  it('under: actual below baselineLower', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: 0.5 });
    expect(d.costInRange).toBe(false);
    expect(d.costMissDirection).toBe('under');
  });

  it('over: actual above marginalFrictionUpper', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: 10 });
    expect(d.costInRange).toBe(false);
    expect(d.costMissDirection).toBe('over');
  });

  it('incomparable: actualCostUsd is null', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: null });
    expect(d.costIncomparable).toBe(true);
    expect(d.costInRange).toBeNull();
    expect(d.costMissDirection).toBeNull();
  });

  it('boundary: actual exactly at baselineLower is inRange', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: 1.0 });
    expect(d.costInRange).toBe(true);
  });

  it('boundary: actual exactly at marginalUpper is inRange', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, totalCostUsd: 5.0 });
    expect(d.costInRange).toBe(true);
  });
});

describe('computePairingDeltas — quality range', () => {
  it('inRange: quality score within [lower, upper]', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, qualityScore: 80 });
    expect(d.qualityInRange).toBe(true);
    expect(d.qualityMissDirection).toBeNull();
    expect(d.qualityIncomparable).toBe(false);
  });

  it('under: quality below lower', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, qualityScore: 60 });
    expect(d.qualityInRange).toBe(false);
    expect(d.qualityMissDirection).toBe('under');
  });

  it('over: quality above upper', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, qualityScore: 95 });
    expect(d.qualityInRange).toBe(false);
    expect(d.qualityMissDirection).toBe('over');
  });

  it('incomparable: qualityScore is null', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, qualityScore: null });
    expect(d.qualityIncomparable).toBe(true);
    expect(d.qualityInRange).toBeNull();
    expect(d.qualityMissDirection).toBeNull();
  });
});

describe('computePairingDeltas — workflow recommendation', () => {
  it('match: predicted FULL, actual FULL', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, workflowType: 'FULL' });
    expect(d.recommendationMatch).toBe(true);
    expect(d.recommendationIncomparable).toBe(false);
  });

  it('mismatch: predicted FULL, actual QUICK', () => {
    const d = computePairingDeltas(basePrediction, { ...baseOutcome, workflowType: 'QUICK' });
    expect(d.recommendationMatch).toBe(false);
  });

  it('mismatch: predicted QUICK, actual FULL', () => {
    const d = computePairingDeltas(
      { ...basePrediction, recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'simple' } },
      { ...baseOutcome, workflowType: 'FULL' }
    );
    expect(d.recommendationMatch).toBe(false);
  });

  it('match: predicted QUICK, actual QUICK', () => {
    const d = computePairingDeltas(
      { ...basePrediction, recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'simple' } },
      { ...baseOutcome, workflowType: 'QUICK' }
    );
    expect(d.recommendationMatch).toBe(true);
  });
});

describe('computePairingDeltas — stored prediction fields', () => {
  it('stores envelope bounds', () => {
    const d = computePairingDeltas(basePrediction, baseOutcome);
    expect(d.predictedCostLowerUsd).toBe(1.0);
    expect(d.predictedCostUpperUsd).toBe(5.0);
    expect(d.predictedBaselineUpperUsd).toBe(3.0);
    expect(d.predictedQualityLower).toBe(70);
    expect(d.predictedQualityUpper).toBe(90);
    expect(d.predictedRecommendation).toBe('FULL');
    expect(d.actualWorkflowType).toBe('FULL');
    expect(d.actualCostUsd).toBe(2.5);
    expect(d.actualQualityScore).toBe(80);
    expect(d.actualFrictionFree).toBe(true);
  });
});
