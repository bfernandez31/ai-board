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
  it('returns emerald classes for Excellent range', () => {
    const colors = getScoreColor(95);
    expect(colors.text).toContain('emerald');
    expect(colors.bg).toContain('emerald');
  });

  it('returns blue classes for Good range', () => {
    const colors = getScoreColor(75);
    expect(colors.text).toContain('blue');
    expect(colors.bg).toContain('blue');
  });

  it('returns amber classes for Fair range', () => {
    const colors = getScoreColor(55);
    expect(colors.text).toContain('amber');
    expect(colors.bg).toContain('amber');
  });

  it('returns red classes for Poor range', () => {
    const colors = getScoreColor(25);
    expect(colors.text).toContain('red');
    expect(colors.bg).toContain('red');
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

describe('computeQualityScore', () => {
  const makeDimensions = (scores: number[]): DimensionScore[] => [
    { name: 'Bug Detection', agentId: 'bug-detection', score: scores[0], weight: 0.3, weightedScore: scores[0] * 0.3 },
    { name: 'Compliance', agentId: 'compliance', score: scores[1], weight: 0.3, weightedScore: scores[1] * 0.3 },
    { name: 'Code Comments', agentId: 'code-comments', score: scores[2], weight: 0.2, weightedScore: scores[2] * 0.2 },
    { name: 'Historical Context', agentId: 'historical-context', score: scores[3], weight: 0.1, weightedScore: scores[3] * 0.1 },
    { name: 'PR Comments', agentId: 'pr-comments', score: scores[4], weight: 0.1, weightedScore: scores[4] * 0.1 },
  ];

  it('computes weighted sum correctly', () => {
    // 90*0.3 + 80*0.3 + 70*0.2 + 85*0.1 + 95*0.1 = 27 + 24 + 14 + 8.5 + 9.5 = 83
    const result = computeQualityScore(makeDimensions([90, 80, 70, 85, 95]));
    expect(result).toBe(83);
  });

  it('rounds 83.5 to 84', () => {
    // Craft scores that produce 83.5: e.g., 90*0.3 + 80*0.3 + 72.5*0.2 + 85*0.1 + 95*0.1
    // = 27 + 24 + 14.5 + 8.5 + 9.5 = 83.5
    const dims = makeDimensions([90, 80, 72, 85, 95]);
    // 90*0.3 + 80*0.3 + 72*0.2 + 85*0.1 + 95*0.1 = 27 + 24 + 14.4 + 8.5 + 9.5 = 83.4
    expect(computeQualityScore(dims)).toBe(83);

    // For exact 83.5: use 72.5 but since scores are integers, let's test with direct dimensions
    const exactDims: DimensionScore[] = [
      { name: 'A', agentId: 'a', score: 90, weight: 0.3, weightedScore: 27 },
      { name: 'B', agentId: 'b', score: 80, weight: 0.3, weightedScore: 24 },
      { name: 'C', agentId: 'c', score: 75, weight: 0.2, weightedScore: 15 },
      { name: 'D', agentId: 'd', score: 75, weight: 0.1, weightedScore: 7.5 },
      { name: 'E', agentId: 'e', score: 100, weight: 0.1, weightedScore: 10 },
    ];
    // 27 + 24 + 15 + 7.5 + 10 = 83.5 → rounds to 84
    expect(computeQualityScore(exactDims)).toBe(84);
  });

  it('returns 100 for perfect scores', () => {
    expect(computeQualityScore(makeDimensions([100, 100, 100, 100, 100]))).toBe(100);
  });

  it('returns 0 for zero scores', () => {
    expect(computeQualityScore(makeDimensions([0, 0, 0, 0, 0]))).toBe(0);
  });
});
