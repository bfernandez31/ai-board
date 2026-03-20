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
  DIMENSIONS,
  DIMENSION_WEIGHTS,
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

describe('DIMENSIONS config', () => {
  it('has active weights (weight > 0) summing to 1.0', () => {
    const activeSum = DIMENSIONS.filter((d) => d.weight > 0).reduce((s, d) => s + d.weight, 0);
    expect(Math.round(activeSum * 100) / 100).toBe(1.0);
  });

  it('contains 5 dimensions', () => {
    expect(DIMENSIONS).toHaveLength(5);
  });

  it('includes spec-sync with weight 0', () => {
    const specSync = DIMENSIONS.find((d) => d.agentId === 'spec-sync');
    expect(specSync).toBeDefined();
    expect(specSync!.weight).toBe(0);
    expect(specSync!.name).toBe('Spec Sync');
  });

  it('does not include pr-comments', () => {
    expect(DIMENSIONS.find((d) => d.agentId === 'pr-comments')).toBeUndefined();
  });

  it('derives DIMENSION_WEIGHTS from DIMENSIONS', () => {
    expect(DIMENSION_WEIGHTS['compliance']).toBe(0.40);
    expect(DIMENSION_WEIGHTS['bug-detection']).toBe(0.30);
    expect(DIMENSION_WEIGHTS['spec-sync']).toBe(0.00);
  });
});

describe('computeQualityScore', () => {
  /** Creates dimensions from DIMENSIONS config with given scores (in config order) */
  const makeDimensions = (scores: number[]): DimensionScore[] =>
    DIMENSIONS.map((d, i) => ({
      name: d.name,
      agentId: d.agentId,
      score: scores[i],
      weight: d.weight,
      weightedScore: scores[i] * d.weight,
    }));

  it('computes weighted sum correctly (spec-sync weight 0 excluded)', () => {
    // compliance:90*0.4 + bug-detection:80*0.3 + code-comments:70*0.2 + historical:85*0.1 + spec-sync:95*0.0
    // = 36 + 24 + 14 + 8.5 + 0 = 82.5 → rounds to 83
    const result = computeQualityScore(makeDimensions([90, 80, 70, 85, 95]));
    expect(result).toBe(83);
  });

  it('rounds half-up correctly', () => {
    const exactDims: DimensionScore[] = [
      { name: 'A', agentId: 'a', score: 90, weight: 0.4, weightedScore: 36 },
      { name: 'B', agentId: 'b', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'C', agentId: 'c', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'D', agentId: 'd', score: 75, weight: 0.1, weightedScore: 7.5 },
      { name: 'E', agentId: 'e', score: 100, weight: 0.0, weightedScore: 0 },
    ];
    // 36 + 24 + 15 + 7.5 + 0 = 82.5 → rounds to 83
    expect(computeQualityScore(exactDims)).toBe(83);
  });

  it('returns 100 for perfect scores', () => {
    expect(computeQualityScore(makeDimensions([100, 100, 100, 100, 100]))).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    expect(computeQualityScore(makeDimensions([0, 0, 0, 0, 0]))).toBe(0);
  });
});
