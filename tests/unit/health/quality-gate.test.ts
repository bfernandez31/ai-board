import { describe, expect, it } from 'vitest';
import {
  computeDistribution,
  computeTrend,
  computeDimensionAverages,
} from '@/lib/health/quality-gate';

describe('computeDistribution', () => {
  it('returns all zeros for empty array', () => {
    expect(computeDistribution([])).toEqual({
      excellent: 0, good: 0, fair: 0, poor: 0,
    });
  });

  it('classifies scores into correct buckets', () => {
    const scores = [95, 92, 85, 75, 70, 55, 40, 30];
    expect(computeDistribution(scores)).toEqual({
      excellent: 2, good: 3, fair: 1, poor: 2,
    });
  });

  it('treats 90 as Excellent boundary', () => {
    expect(computeDistribution([90])).toEqual({
      excellent: 1, good: 0, fair: 0, poor: 0,
    });
  });

  it('treats 70 as Good boundary', () => {
    expect(computeDistribution([70])).toEqual({
      excellent: 0, good: 1, fair: 0, poor: 0,
    });
  });

  it('treats 50 as Fair boundary', () => {
    expect(computeDistribution([50])).toEqual({
      excellent: 0, good: 0, fair: 1, poor: 0,
    });
  });

  it('treats 49 as Poor', () => {
    expect(computeDistribution([49])).toEqual({
      excellent: 0, good: 0, fair: 0, poor: 1,
    });
  });
});

describe('computeTrend', () => {
  it('returns null trend when current avg is null', () => {
    expect(computeTrend(null, 80)).toEqual({ trend: null, trendDelta: null });
  });

  it('returns null trend when previous avg is null', () => {
    expect(computeTrend(80, null)).toEqual({ trend: null, trendDelta: null });
  });

  it('returns "up" when current > previous by more than 1', () => {
    const result = computeTrend(85, 80);
    expect(result.trend).toBe('up');
    expect(result.trendDelta).toBe(5);
  });

  it('returns "down" when current < previous by more than 1', () => {
    const result = computeTrend(75, 80);
    expect(result.trend).toBe('down');
    expect(result.trendDelta).toBe(-5);
  });

  it('returns "stable" when difference is within 1 point', () => {
    expect(computeTrend(80, 80).trend).toBe('stable');
    expect(computeTrend(81, 80).trend).toBe('stable');
    expect(computeTrend(79, 80).trend).toBe('stable');
  });

  it('returns "up" when delta is exactly 2', () => {
    expect(computeTrend(82, 80).trend).toBe('up');
  });

  it('returns "down" when delta is exactly -2', () => {
    expect(computeTrend(78, 80).trend).toBe('down');
  });
});

describe('computeDimensionAverages', () => {
  it('returns all null averages for empty array', () => {
    const result = computeDimensionAverages([]);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d.averageScore === null)).toBe(true);
  });

  it('returns null averages for invalid JSON', () => {
    const result = computeDimensionAverages(['not json', null, '']);
    expect(result.every((d) => d.averageScore === null)).toBe(true);
  });

  it('computes averages from valid dimension data', () => {
    const details1 = JSON.stringify({
      dimensions: [
        { agentId: 'compliance', name: 'Compliance', score: 80, weight: 0.40, weightedScore: 32 },
        { agentId: 'bug-detection', name: 'Bug Detection', score: 70, weight: 0.30, weightedScore: 21 },
        { agentId: 'code-comments', name: 'Code Comments', score: 60, weight: 0.20, weightedScore: 12 },
        { agentId: 'historical-context', name: 'Historical Context', score: 50, weight: 0.10, weightedScore: 5 },
        { agentId: 'spec-sync', name: 'Spec Sync', score: 40, weight: 0.00, weightedScore: 0 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-20T10:00:00Z',
    });

    const details2 = JSON.stringify({
      dimensions: [
        { agentId: 'compliance', name: 'Compliance', score: 90, weight: 0.40, weightedScore: 36 },
        { agentId: 'bug-detection', name: 'Bug Detection', score: 80, weight: 0.30, weightedScore: 24 },
        { agentId: 'code-comments', name: 'Code Comments', score: 70, weight: 0.20, weightedScore: 14 },
        { agentId: 'historical-context', name: 'Historical Context', score: 60, weight: 0.10, weightedScore: 6 },
        { agentId: 'spec-sync', name: 'Spec Sync', score: 50, weight: 0.00, weightedScore: 0 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-25T10:00:00Z',
    });

    const result = computeDimensionAverages([details1, details2]);

    expect(result.find((d) => d.name === 'Compliance')?.averageScore).toBe(85);
    expect(result.find((d) => d.name === 'Bug Detection')?.averageScore).toBe(75);
    expect(result.find((d) => d.name === 'Code Comments')?.averageScore).toBe(65);
    expect(result.find((d) => d.name === 'Historical Context')?.averageScore).toBe(55);
    expect(result.find((d) => d.name === 'Spec Sync')?.averageScore).toBe(45);
  });

  it('skips entries with missing dimensions field', () => {
    const valid = JSON.stringify({
      dimensions: [
        { agentId: 'compliance', name: 'Compliance', score: 80, weight: 0.40, weightedScore: 32 },
      ],
      threshold: 'Good',
      computedAt: '2026-03-20T10:00:00Z',
    });

    const invalid = JSON.stringify({ threshold: 'Good' });

    const result = computeDimensionAverages([valid, invalid]);
    expect(result.find((d) => d.name === 'Compliance')?.averageScore).toBe(80);
  });

  it('returns dimensions in DIMENSION_CONFIG order with correct weights', () => {
    const result = computeDimensionAverages([]);
    expect(result[0].name).toBe('Compliance');
    expect(result[0].weight).toBe(0.40);
    expect(result[1].name).toBe('Bug Detection');
    expect(result[1].weight).toBe(0.30);
    expect(result[4].name).toBe('Spec Sync');
    expect(result[4].weight).toBe(0.00);
  });
});
