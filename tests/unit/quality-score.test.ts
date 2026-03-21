/**
 * Unit Tests: Quality Score Utilities
 *
 * Tests weighted sum formula, rounding, threshold derivation, boundary values.
 */

import { describe, it, expect } from 'vitest';
import {
  getScoreThreshold,
  getScoreColor,
  parseQualityScoreDetails,
  computeQualityScore,
  DIMENSION_CONFIG,
  DIMENSION_WEIGHTS,
  getDimensionName,
  getDimensionWeight,
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
    expect(colors.fill).toBe('bg-ctp-green');
  });

  it('returns ctp-blue classes for Good range', () => {
    const colors = getScoreColor(75);
    expect(colors.text).toBe('text-ctp-blue');
    expect(colors.bg).toBe('bg-ctp-blue/10');
    expect(colors.fill).toBe('bg-ctp-blue');
  });

  it('returns ctp-yellow classes for Fair range', () => {
    const colors = getScoreColor(55);
    expect(colors.text).toBe('text-ctp-yellow');
    expect(colors.bg).toBe('bg-ctp-yellow/10');
    expect(colors.fill).toBe('bg-ctp-yellow');
  });

  it('returns ctp-red classes for Poor range', () => {
    const colors = getScoreColor(25);
    expect(colors.text).toBe('text-ctp-red');
    expect(colors.bg).toBe('bg-ctp-red/10');
    expect(colors.fill).toBe('bg-ctp-red');
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

describe('DIMENSION_CONFIG', () => {
  it('has exactly 5 entries', () => {
    expect(DIMENSION_CONFIG).toHaveLength(5);
  });

  it('active weights (>0) sum to 1.00', () => {
    const activeSum = DIMENSION_CONFIG
      .filter(d => d.weight > 0)
      .reduce((sum, d) => sum + d.weight, 0);
    expect(activeSum).toBeCloseTo(1.0);
  });

  it('DIMENSION_WEIGHTS derived map matches config values', () => {
    for (const dim of DIMENSION_CONFIG) {
      expect(DIMENSION_WEIGHTS[dim.agentId]).toBe(dim.weight);
    }
    expect(Object.keys(DIMENSION_WEIGHTS)).toHaveLength(DIMENSION_CONFIG.length);
  });

  it('getDimensionName returns correct display names', () => {
    expect(getDimensionName('compliance')).toBe('Compliance');
    expect(getDimensionName('bug-detection')).toBe('Bug Detection');
    expect(getDimensionName('code-comments')).toBe('Code Comments');
    expect(getDimensionName('historical-context')).toBe('Historical Context');
    expect(getDimensionName('spec-sync')).toBe('Spec Sync');
    expect(getDimensionName('unknown')).toBe('unknown');
  });

  it('getDimensionWeight returns correct weights', () => {
    expect(getDimensionWeight('compliance')).toBe(0.40);
    expect(getDimensionWeight('bug-detection')).toBe(0.30);
    expect(getDimensionWeight('code-comments')).toBe(0.20);
    expect(getDimensionWeight('historical-context')).toBe(0.10);
    expect(getDimensionWeight('spec-sync')).toBe(0.00);
    expect(getDimensionWeight('unknown')).toBe(0);
  });
});

describe('computeQualityScore', () => {
  const makeDimensions = (scores: number[]): DimensionScore[] => [
    { name: 'Compliance', agentId: 'compliance', score: scores[0], weight: 0.40, weightedScore: scores[0] * 0.40 },
    { name: 'Bug Detection', agentId: 'bug-detection', score: scores[1], weight: 0.30, weightedScore: scores[1] * 0.30 },
    { name: 'Code Comments', agentId: 'code-comments', score: scores[2], weight: 0.20, weightedScore: scores[2] * 0.20 },
    { name: 'Historical Context', agentId: 'historical-context', score: scores[3], weight: 0.10, weightedScore: scores[3] * 0.10 },
    { name: 'Spec Sync', agentId: 'spec-sync', score: scores[4], weight: 0.00, weightedScore: 0 },
  ];

  it('computes weighted sum correctly', () => {
    // 90*0.40 + 80*0.30 + 70*0.20 + 85*0.10 + 95*0.00 = 36 + 24 + 14 + 8.5 + 0 = 82.5 → 83
    const result = computeQualityScore(makeDimensions([90, 80, 70, 85, 95]));
    expect(result).toBe(83);
  });

  it('rounds 83.5 to 84', () => {
    // 90*0.40 + 80*0.30 + 72*0.20 + 85*0.10 + 95*0.00 = 36 + 24 + 14.4 + 8.5 + 0 = 82.9
    const dims = makeDimensions([90, 80, 72, 85, 95]);
    expect(computeQualityScore(dims)).toBe(83);

    // For exact 83.5: use direct dimensions
    const exactDims: DimensionScore[] = [
      { name: 'A', agentId: 'a', score: 90, weight: 0.4, weightedScore: 36 },
      { name: 'B', agentId: 'b', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'C', agentId: 'c', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'D', agentId: 'd', score: 85, weight: 0.1, weightedScore: 8.5 },
    ];
    // 36 + 24 + 15 + 8.5 = 83.5 → rounds to 84
    expect(computeQualityScore(exactDims)).toBe(84);
  });

  it('returns 100 for perfect scores', () => {
    expect(computeQualityScore(makeDimensions([100, 100, 100, 100, 100]))).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    expect(computeQualityScore(makeDimensions([0, 0, 0, 0, 0]))).toBe(0);
  });

  it('spec-sync at weight 0.00 does not affect global score', () => {
    const withLowSpecSync = computeQualityScore(makeDimensions([80, 80, 80, 80, 50]));
    const withHighSpecSync = computeQualityScore(makeDimensions([80, 80, 80, 80, 100]));
    expect(withLowSpecSync).toBe(withHighSpecSync);
  });
});
