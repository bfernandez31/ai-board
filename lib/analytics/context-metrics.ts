export type ContextRiskBand = 'HEALTHY' | 'WARNING' | 'DANGER';
export type QualityBucket = 'HIGH' | 'MEDIUM' | 'LOW';

type ContextRiskThreshold = {
  band: ContextRiskBand;
  minInclusive: number;
  label: string;
  badgeClassName: string;
};

type PeakContextBucketDefinition = {
  label: string;
  minInclusive: number;
  maxExclusive: number | null;
};

// Initial operating bands. These stay centralized so ticket and analytics
// surfaces classify jobs consistently while leaving room for future tuning.
export const CONTEXT_RISK_THRESHOLDS: readonly ContextRiskThreshold[] = [
  {
    band: 'DANGER',
    minInclusive: 120_000,
    label: 'Danger',
    badgeClassName: 'bg-ctp-red/15 text-ctp-red border-ctp-red/30',
  },
  {
    band: 'WARNING',
    minInclusive: 80_000,
    label: 'Warning',
    badgeClassName: 'bg-ctp-yellow/15 text-ctp-yellow border-ctp-yellow/30',
  },
  {
    band: 'HEALTHY',
    minInclusive: 0,
    label: 'Healthy',
    badgeClassName: 'bg-ctp-green/15 text-ctp-green border-ctp-green/30',
  },
] as const;

export const PEAK_CONTEXT_BUCKETS: readonly PeakContextBucketDefinition[] = [
  { label: '<40K', minInclusive: 0, maxExclusive: 40_000 },
  { label: '40K-79K', minInclusive: 40_000, maxExclusive: 80_000 },
  { label: '80K-119K', minInclusive: 80_000, maxExclusive: 120_000 },
  { label: '120K+', minInclusive: 120_000, maxExclusive: null },
] as const;

export function classifyContextRiskBand(peakContextSize: number | null | undefined): ContextRiskBand | null {
  if (peakContextSize == null || peakContextSize < 0) {
    return null;
  }

  const threshold = CONTEXT_RISK_THRESHOLDS.find(
    (candidate) => peakContextSize >= candidate.minInclusive
  );

  return threshold?.band ?? 'HEALTHY';
}

export function getContextRiskConfig(
  peakContextSize: number | null | undefined
): ContextRiskThreshold | null {
  const band = classifyContextRiskBand(peakContextSize);
  if (!band) {
    return null;
  }

  return CONTEXT_RISK_THRESHOLDS.find((threshold) => threshold.band === band) ?? null;
}

export function formatContextSize(value: number | null | undefined): string {
  if (value == null || value < 0) {
    return '-';
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M tokens`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K tokens`;
  }

  return `${value} tokens`;
}

export function getPeakContextBucket(
  peakContextSize: number | null | undefined
): PeakContextBucketDefinition | null {
  if (peakContextSize == null || peakContextSize < 0) {
    return null;
  }

  return PEAK_CONTEXT_BUCKETS.find((bucket) => (
    peakContextSize >= bucket.minInclusive
    && (bucket.maxExclusive == null || peakContextSize < bucket.maxExclusive)
  )) ?? null;
}

export function classifyQualityBucket(qualityScore: number | null | undefined): QualityBucket | null {
  if (qualityScore == null || qualityScore < 0) {
    return null;
  }

  if (qualityScore >= 80) {
    return 'HIGH';
  }

  if (qualityScore >= 60) {
    return 'MEDIUM';
  }

  return 'LOW';
}
