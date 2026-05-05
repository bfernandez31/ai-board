export interface PairingDeltas {
  predictedFriction: string;
  actualFrictionFree: boolean;
  frictionPredictedLow: boolean;
  frictionMatch: boolean;
  frictionEmerged: boolean;
  frictionIncomparable: boolean;

  predictedCostLowerUsd: number | null;
  predictedCostUpperUsd: number | null;
  predictedBaselineUpperUsd: number | null;
  actualCostUsd: number | null;
  costInRange: boolean | null;
  costMissDirection: string | null;
  costIncomparable: boolean;

  predictedQualityLower: number | null;
  predictedQualityUpper: number | null;
  actualQualityScore: number | null;
  qualityInRange: boolean | null;
  qualityMissDirection: string | null;
  qualityIncomparable: boolean;

  predictedRecommendation: string;
  actualWorkflowType: string;
  recommendationMatch: boolean;
  recommendationIncomparable: boolean;
}

export interface DriftFilters {
  cursor?: string;
  pageSize?: number;
}

export interface DriftRecentPairing {
  ticketId: number;
  ticketKey: string;
  shippedAt: string;
  frictionMatch: boolean | null;
  costInRange: boolean | null;
  qualityInRange: boolean | null;
  recommendationMatch: boolean | null;
}

export interface DriftDashboardSnapshot {
  projectId: number;
  generatedAt: string;
  sampleSize: number;
  unpairedCount: number;
  pendingCount: number;

  friction: {
    incomparable: number;
    matrix: { tp: number; fp: number; tn: number; fn: number };
    precision: number | null;
    recall: number | null;
  };

  cost: {
    incomparable: number;
    inRange: number;
    under: number;
    over: number;
  };

  quality: {
    incomparable: number;
    inRange: number;
    under: number;
    over: number;
  };

  usage: {
    analysedShipped: number;
    leftInbox: number;
    ratio: number;
  };

  recentPairings: DriftRecentPairing[];
  nextCursor: string | null;
}

export type DriftData = DriftDashboardSnapshot;
