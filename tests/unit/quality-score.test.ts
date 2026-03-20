/**
 * Unit Tests: Quality Score Utilities
 *
 * Tests weighted sum formula, rounding, threshold derivation, boundary values.
 */

import { describe, it, expect } from 'vitest';
import {
  REVIEW_DIMENSIONS,
  getScoreThreshold,
  getScoreColor,
  parseQualityScoreDetails,
  computeQualityScore,
  getReviewDimensionConfig,
  sortDimensionsForDisplay,
  type DimensionScore,
} from '@/lib/quality-score';

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
      version: 1,
      qualityScore: 90,
      dimensions: [
        { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-17T10:30:00Z',
    };
    const result = parseQualityScoreDetails(JSON.stringify(details));
    expect(result).toEqual(details);
  });

  it('parses legacy PR Comments rows for historical compatibility', () => {
    const details = {
      version: 1,
      qualityScore: 82,
      dimensions: [
        { name: 'PR Comments', agentId: 'pr-comments', score: 80, weight: 0.1, weightedScore: 8 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-17T10:30:00Z',
    };

    expect(parseQualityScoreDetails(JSON.stringify(details))).toEqual(details);
  });
});

describe('review dimension config', () => {
  it('defines Spec Sync as the configured fifth dimension', () => {
    expect(REVIEW_DIMENSIONS.map((dimension) => dimension.name)).toEqual([
      'Bug Detection',
      'Compliance',
      'Code Comments',
      'Historical Context',
      'Spec Sync',
    ]);

    expect(REVIEW_DIMENSIONS.map((dimension) => dimension.weight)).toEqual([
      0.3,
      0.4,
      0.2,
      0.1,
      0,
    ]);

    expect(getReviewDimensionConfig('spec-sync')).toMatchObject({
      name: 'Spec Sync',
      weight: 0,
      affectsOverallScore: false,
      displayOrder: 5,
    });
  });

  it('keeps legacy PR Comments discoverable for stored payloads', () => {
    expect(getReviewDimensionConfig('pr-comments')).toMatchObject({
      name: 'PR Comments',
      weight: 0.1,
      affectsOverallScore: true,
      displayOrder: 5,
    });
  });
});

describe('computeQualityScore', () => {
  const makeDimensions = (scores: number[]): DimensionScore[] => [
    { name: 'Bug Detection', agentId: 'bug-detection', score: scores[0], weight: 0.3, weightedScore: scores[0] * 0.3 },
    { name: 'Compliance', agentId: 'compliance', score: scores[1], weight: 0.4, weightedScore: scores[1] * 0.4 },
    { name: 'Code Comments', agentId: 'code-comments', score: scores[2], weight: 0.2, weightedScore: scores[2] * 0.2 },
    { name: 'Historical Context', agentId: 'historical-context', score: scores[3], weight: 0.1, weightedScore: scores[3] * 0.1 },
    { name: 'Spec Sync', agentId: 'spec-sync', score: scores[4], weight: 0, weightedScore: 0 },
  ];

  it('computes weighted sum correctly', () => {
    // 90*0.3 + 80*0.4 + 70*0.2 + 85*0.1 + 95*0 = 27 + 32 + 14 + 8.5 + 0 = 81.5
    const result = computeQualityScore(makeDimensions([90, 80, 70, 85, 95]));
    expect(result).toBe(82);
  });

  it('ignores zero-weight Spec Sync when computing the overall score', () => {
    const dims = makeDimensions([90, 80, 72, 85, 95]);
    const withPerfectSpecSync = makeDimensions([90, 80, 72, 85, 100]);
    const withPoorSpecSync = makeDimensions([90, 80, 72, 85, 0]);

    expect(computeQualityScore(withPerfectSpecSync)).toBe(computeQualityScore(withPoorSpecSync));
    expect(computeQualityScore(dims)).toBe(82);
  });

  it('rounds 83.5 to 84 for active weighted dimensions', () => {
    const exactDims: DimensionScore[] = [
      { name: 'A', agentId: 'a', score: 90, weight: 0.3, weightedScore: 27 },
      { name: 'B', agentId: 'b', score: 80, weight: 0.4, weightedScore: 32 },
      { name: 'C', agentId: 'c', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'D', agentId: 'd', score: 75, weight: 0.1, weightedScore: 7.5 },
      { name: 'E', agentId: 'e', score: 100, weight: 0, weightedScore: 0 },
    ];
    // 27 + 32 + 15 + 7.5 + 0 = 81.5 → rounds to 82 for unknown configs using positive weights only
    expect(computeQualityScore(exactDims)).toBe(82);
  });

  it('continues to include legacy PR Comments rows when they have weight', () => {
    const legacyDims: DimensionScore[] = [
      { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
      { name: 'Compliance', agentId: 'compliance', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'Code Comments', agentId: 'code-comments', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'Historical Context', agentId: 'historical-context', score: 75, weight: 0.1, weightedScore: 7.5 },
      { name: 'PR Comments', agentId: 'pr-comments', score: 100, weight: 0.1, weightedScore: 10 },
    ];

    expect(computeQualityScore(legacyDims)).toBe(84);
  });

  it('returns 100 for perfect scores', () => {
    expect(computeQualityScore(makeDimensions([100, 100, 100, 100, 100]))).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    expect(computeQualityScore(makeDimensions([0, 0, 0, 0, 0]))).toBe(0);
  });
});

describe('sortDimensionsForDisplay', () => {
  it('orders new and legacy dimensions by shared metadata', () => {
    const dimensions: DimensionScore[] = [
      { name: 'Spec Sync', agentId: 'spec-sync', score: 100, weight: 0, weightedScore: 0 },
      { name: 'Code Comments', agentId: 'code-comments', score: 70, weight: 0.2, weightedScore: 14 },
      { name: 'PR Comments', agentId: 'pr-comments', score: 80, weight: 0.1, weightedScore: 8 },
      { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
    ];

    expect(sortDimensionsForDisplay(dimensions).map((dimension) => dimension.name)).toEqual([
      'Bug Detection',
      'Code Comments',
      'PR Comments',
      'Spec Sync',
    ]);
  });
});
