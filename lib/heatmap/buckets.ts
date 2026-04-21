/**
 * Heatmap intensity bucketing (pure functions).
 *
 * Decision 5 (research.md): 5 levels. Level 0 == count=0. For non-zero
 * counts, thresholds are p50/p75/p90 of the non-zero distribution, rounded
 * up, monotonic, degenerate-safe.
 */

import type { HeatmapIntensityThresholds } from './types';

const DEFAULT_THRESHOLDS: HeatmapIntensityThresholds = { t1: 1, t2: 1, t3: 1, t4: 1 };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (sorted.length - 1) * p;
  const lowIndex = Math.floor(rank);
  const highIndex = Math.ceil(rank);
  const low = sorted[lowIndex] ?? 0;
  const high = sorted[highIndex] ?? low;
  if (lowIndex === highIndex) return low;
  const fraction = rank - lowIndex;
  return low + (high - low) * fraction;
}

export function computeIntensityThresholds(
  nonZeroCounts: number[]
): HeatmapIntensityThresholds {
  if (nonZeroCounts.length === 0) return { ...DEFAULT_THRESHOLDS };

  const sorted = [...nonZeroCounts].sort((a, b) => a - b);

  const raw50 = Math.max(1, Math.ceil(percentile(sorted, 0.5)));
  const raw75 = Math.max(1, Math.ceil(percentile(sorted, 0.75)));
  const raw90 = Math.max(1, Math.ceil(percentile(sorted, 0.9)));

  const t1 = 1;
  const t2 = Math.max(raw50, t1);
  const t3 = Math.max(raw75, t2);
  const t4 = Math.max(raw90, t3);

  return { t1, t2, t3, t4 };
}

export function bucketFor(
  count: number,
  thresholds: HeatmapIntensityThresholds
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count >= thresholds.t4) return 4;
  if (count >= thresholds.t3) return 3;
  if (count >= thresholds.t2) return 2;
  if (count >= thresholds.t1) return 1;
  return 0;
}
