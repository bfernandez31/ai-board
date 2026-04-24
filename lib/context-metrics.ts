export const CONTEXT_WARNING_TOKENS = 60_000;
export const CONTEXT_DANGER_TOKENS = 90_000;

export type ContextRiskLevel = 'healthy' | 'warning' | 'danger';
const CONTEXT_RISK_LABELS: Record<ContextRiskLevel, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  danger: 'Danger',
};

export type ContextHistogramBucket = {
  minTokens: number;
  maxTokens: number | null;
  label: string;
};

export const CONTEXT_HISTOGRAM_BUCKETS: readonly ContextHistogramBucket[] = [
  { minTokens: 0, maxTokens: 16_000, label: '0-16K' },
  { minTokens: 16_000, maxTokens: 32_000, label: '16K-32K' },
  { minTokens: 32_000, maxTokens: 48_000, label: '32K-48K' },
  { minTokens: 48_000, maxTokens: 64_000, label: '48K-64K' },
  { minTokens: 64_000, maxTokens: 80_000, label: '64K-80K' },
  { minTokens: 80_000, maxTokens: 96_000, label: '80K-96K' },
  { minTokens: 96_000, maxTokens: null, label: '96K+' },
] as const;

export function getContextRiskLevel(tokens: number): ContextRiskLevel {
  if (tokens >= CONTEXT_DANGER_TOKENS) {
    return 'danger';
  }
  if (tokens >= CONTEXT_WARNING_TOKENS) {
    return 'warning';
  }
  return 'healthy';
}

export function getContextRiskLabel(tokens: number): string {
  return CONTEXT_RISK_LABELS[getContextRiskLevel(tokens)];
}

export function getContextHistogramLabel(tokens: number): string {
  const bucket = CONTEXT_HISTOGRAM_BUCKETS.find(
    (candidate) =>
      tokens >= candidate.minTokens &&
      (candidate.maxTokens == null || tokens < candidate.maxTokens)
  );

  return bucket?.label ?? CONTEXT_HISTOGRAM_BUCKETS[CONTEXT_HISTOGRAM_BUCKETS.length - 1]!.label;
}

export function getQualityScoreBucket(score: number | null): string {
  if (score == null) {
    return 'Unscored';
  }
  if (score < 50) {
    return '0-49';
  }
  if (score < 70) {
    return '50-69';
  }
  if (score < 85) {
    return '70-84';
  }
  return '85-100';
}
