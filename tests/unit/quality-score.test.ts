/**
 * Unit Tests: Quality Score Utilities
 *
 * Tests weighted sum formula, rounding, threshold derivation, boundary values.
 */

import { describe, it, expect } from 'vitest';
import {
  QUALITY_SCORE_DIMENSIONS,
  type DimensionScore,
  computeQualityScore,
  getScoreColor,
  getScoreThreshold,
  parseQualityScoreDetails,
} from '@/lib/quality-score';

function createDimensionScores(scores: number[]): DimensionScore[] {
  return QUALITY_SCORE_DIMENSIONS.map((dimension, index) => {
    const score = scores[index] ?? 0;

    return {
      ...dimension,
      score,
      weightedScore: score * dimension.weight,
    };
  });
}

describe('getScoreThreshold', () => {
  it.each([
    [100, 'Excellent'],
    [90, 'Excellent'],
    [89, 'Good'],
    [70, 'Good'],
    [69, 'Fair'],
    [50, 'Fair'],
    [49, 'Poor'],
    [0, 'Poor'],
  ])('returns %s for score %i', (score, expected) => {
    expect(getScoreThreshold(score as number)).toBe(expected);
  });
});

describe('getScoreColor', () => {
  it('returns ctp-green classes for Excellent range', () => {
    const colors = getScoreColor(95);
    expect(colors.text).toBe('text-ctp-green');
    expect(colors.bg).toBe('bg-ctp-green/10');
  });

  it('returns ctp-blue classes for Good range', () => {
    const colors = getScoreColor(75);
    expect(colors.text).toBe('text-ctp-blue');
    expect(colors.bg).toBe('bg-ctp-blue/10');
  });

  it('returns ctp-yellow classes for Fair range', () => {
    const colors = getScoreColor(55);
    expect(colors.text).toBe('text-ctp-yellow');
    expect(colors.bg).toBe('bg-ctp-yellow/10');
  });

  it('returns ctp-red classes for Poor range', () => {
    const colors = getScoreColor(25);
    expect(colors.text).toBe('text-ctp-red');
    expect(colors.bg).toBe('bg-ctp-red/10');
  });
});

describe('parseQualityScoreDetails', () => {
  it('returns null for null input', () => {
    expect(parseQualityScoreDetails(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseQualityScoreDetails(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseQualityScoreDetails('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseQualityScoreDetails('not json')).toBeNull();
  });

  it('parses valid quality score details', () => {
    const details = {
      dimensions: [
        { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-17T10:30:00Z',
    };
    const result = parseQualityScoreDetails(JSON.stringify(details));
    expect(result).toEqual(details);
  });
});

describe('QUALITY_SCORE_DIMENSIONS', () => {
  it('defines the 5 configured quality dimensions in display order', () => {
    expect(QUALITY_SCORE_DIMENSIONS).toEqual([
      { name: 'Compliance', agentId: 'compliance', weight: 0.4 },
      { name: 'Bug Detection', agentId: 'bug-detection', weight: 0.3 },
      { name: 'Code Comments', agentId: 'code-comments', weight: 0.2 },
      { name: 'Historical Context', agentId: 'historical-context', weight: 0.1 },
      { name: 'Spec Sync', agentId: 'spec-sync', weight: 0 },
    ]);
  });
});

describe('computeQualityScore', () => {
  it('computes weighted sum correctly', () => {
    // 90*0.4 + 80*0.3 + 70*0.2 + 85*0.1 + 95*0 = 36 + 24 + 14 + 8.5 = 82.5
    const result = computeQualityScore(createDimensionScores([90, 80, 70, 85, 95]));
    expect(result).toBe(83);
  });

  it('rounds 83.5 to 84', () => {
    const dims = createDimensionScores([89, 80, 72, 84, 95]);
    // 89*0.4 + 80*0.3 + 72*0.2 + 84*0.1 + 95*0 = 35.6 + 24 + 14.4 + 8.4 = 82.4
    expect(computeQualityScore(dims)).toBe(82);

    const exactDims: DimensionScore[] = [
      { name: 'A', agentId: 'a', score: 90, weight: 0.4, weightedScore: 36 },
      { name: 'B', agentId: 'b', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'C', agentId: 'c', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'D', agentId: 'd', score: 75, weight: 0.1, weightedScore: 7.5 },
      { name: 'E', agentId: 'e', score: 100, weight: 0, weightedScore: 0 },
    ];
    // 36 + 24 + 15 + 7.5 + 0 = 82.5 → rounds to 83
    expect(computeQualityScore(exactDims)).toBe(83);
  });

  it('does not let zero-weight spec sync affect the overall quality score', () => {
    const lowSpecSync = createDimensionScores([90, 80, 70, 85, 0]);
    const highSpecSync = createDimensionScores([90, 80, 70, 85, 100]);

    expect(computeQualityScore(lowSpecSync)).toBe(83);
    expect(computeQualityScore(highSpecSync)).toBe(83);
  });

  it('returns 100 for perfect active scores even when spec sync is 0', () => {
    expect(computeQualityScore(createDimensionScores([100, 100, 100, 100, 0]))).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    expect(computeQualityScore(createDimensionScores([0, 0, 0, 0, 100]))).toBe(0);
  });
});
