/**
 * Pure aggregators that turn raw AnalysisCalibration rows into the dashboard DTO.
 */
import type { AnalysisCalibration } from '@prisma/client';
import type {
  AdoptionData,
  CalibrationDashboardData,
  ConfusionMatrix,
  RecommendationPanelData,
  VerdictDistribution,
} from './types';

export function aggregateConfusionMatrix(
  rows: Pick<AnalysisCalibration, 'frictionCell'>[]
): ConfusionMatrix {
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const row of rows) {
    switch (row.frictionCell) {
      case 'TP':
        truePositive += 1;
        break;
      case 'TN':
        trueNegative += 1;
        break;
      case 'FP':
        falsePositive += 1;
        break;
      case 'FN':
        falseNegative += 1;
        break;
    }
  }
  const total = truePositive + trueNegative + falsePositive + falseNegative;
  const precisionDenom = truePositive + falsePositive;
  const recallDenom = truePositive + falseNegative;
  return {
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    precisionLowRisk: precisionDenom === 0 ? null : truePositive / precisionDenom,
    recallLowRisk: recallDenom === 0 ? null : truePositive / recallDenom,
    total,
  };
}

export function aggregateVerdictDistribution(
  rows: AnalysisCalibration[],
  signal: 'quality' | 'cost'
): VerdictDistribution {
  let hit = 0;
  let miss = 0;
  let na = 0;
  for (const row of rows) {
    const verdict = signal === 'quality' ? row.qualityVerdict : row.costVerdict;
    if (verdict === 'hit') hit += 1;
    else if (verdict === 'miss') miss += 1;
    else if (verdict === 'n_a') na += 1;
  }
  const total = hit + miss + na;
  const hitDenom = hit + miss;
  return {
    hit,
    miss,
    na,
    total,
    hitRate: hitDenom === 0 ? null : hit / hitDenom,
  };
}

export function aggregateRecommendation(
  rows: Pick<AnalysisCalibration, 'recommendationMatched' | 'recommendationFrictionAligned'>[]
): RecommendationPanelData {
  let matched = 0;
  let frictionAligned = 0;
  for (const row of rows) {
    if (row.recommendationMatched) matched += 1;
    if (row.recommendationFrictionAligned) frictionAligned += 1;
  }
  const denom = rows.length;
  return {
    matchedRate: denom === 0 ? null : matched / denom,
    frictionAlignedRate: denom === 0 ? null : frictionAligned / denom,
    counts: {
      matched,
      frictionAligned,
    },
  };
}

export interface ComposeDashboardInput {
  rows: AnalysisCalibration[];
  totalRows: number;
  adoption: AdoptionData;
  generatedAt: Date;
}

export function composeDashboardData(
  input: ComposeDashboardInput
): CalibrationDashboardData {
  const { rows, totalRows, adoption, generatedAt } = input;
  return {
    windowSize: rows.length,
    totalRows,
    warmingUp: totalRows < 30,
    confusionMatrix: aggregateConfusionMatrix(rows),
    qualityDistribution: aggregateVerdictDistribution(rows, 'quality'),
    costDistribution: aggregateVerdictDistribution(rows, 'cost'),
    recommendation: aggregateRecommendation(rows),
    adoption,
    generatedAt: generatedAt.toISOString(),
  };
}
