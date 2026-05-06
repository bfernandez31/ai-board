import { describe, it, expect } from 'vitest';
import {
  binariseFriction,
  classifyFrictionCell,
  computeRecommendationAxes,
  quantifyCostVerdict,
  quantifyQualityVerdict,
  sumCostRange,
} from '@/lib/calibration/derive';

describe('binariseFriction', () => {
  it('returns true for low risk', () => {
    expect(binariseFriction('low')).toBe(true);
  });
  it('returns false for medium and high', () => {
    expect(binariseFriction('medium')).toBe(false);
    expect(binariseFriction('high')).toBe(false);
  });
});

describe('classifyFrictionCell', () => {
  const cases: Array<[boolean, boolean, 'TP' | 'TN' | 'FP' | 'FN']> = [
    [true, true, 'TP'],
    [false, false, 'TN'],
    [true, false, 'FP'],
    [false, true, 'FN'],
  ];
  for (const [predictedClean, actualFree, expected] of cases) {
    it(`predictedClean=${predictedClean} actualFree=${actualFree} → ${expected}`, () => {
      expect(classifyFrictionCell(predictedClean, actualFree)).toBe(expected);
    });
  }
});

describe('quantifyQualityVerdict', () => {
  it('returns n_a when actual is null', () => {
    expect(quantifyQualityVerdict(null, 60, 80)).toBe('n_a');
  });
  it('returns hit when actual is within inclusive bounds', () => {
    expect(quantifyQualityVerdict(60, 60, 80)).toBe('hit');
    expect(quantifyQualityVerdict(80, 60, 80)).toBe('hit');
    expect(quantifyQualityVerdict(70, 60, 80)).toBe('hit');
  });
  it('returns miss when actual is outside the range', () => {
    expect(quantifyQualityVerdict(59, 60, 80)).toBe('miss');
    expect(quantifyQualityVerdict(81, 60, 80)).toBe('miss');
  });
});

describe('quantifyCostVerdict', () => {
  it('returns n_a when actual is null', () => {
    expect(quantifyCostVerdict(null, 1, 5)).toBe('n_a');
  });
  it('returns hit when actual is within inclusive summed bounds', () => {
    expect(quantifyCostVerdict(1, 1, 5)).toBe('hit');
    expect(quantifyCostVerdict(5, 1, 5)).toBe('hit');
    expect(quantifyCostVerdict(3.5, 1, 5)).toBe('hit');
  });
  it('returns miss when actual is outside the range', () => {
    expect(quantifyCostVerdict(0.99, 1, 5)).toBe('miss');
    expect(quantifyCostVerdict(5.01, 1, 5)).toBe('miss');
  });
});

describe('computeRecommendationAxes', () => {
  it('matched=true when predicted equals actual workflowType', () => {
    expect(computeRecommendationAxes('QUICK', 'QUICK', true).matched).toBe(true);
    expect(computeRecommendationAxes('FULL', 'FULL', false).matched).toBe(true);
  });
  it('matched=false when predicted differs from actual workflowType', () => {
    expect(computeRecommendationAxes('QUICK', 'FULL', true).matched).toBe(false);
    expect(computeRecommendationAxes('FULL', 'QUICK', false).matched).toBe(false);
  });
  it('matched=false when actual workflowType is CLEAN (legacy)', () => {
    expect(computeRecommendationAxes('QUICK', 'CLEAN', true).matched).toBe(false);
    expect(computeRecommendationAxes('FULL', 'CLEAN', false).matched).toBe(false);
  });
  it('frictionAligned=true when QUICK + frictionFree', () => {
    expect(computeRecommendationAxes('QUICK', 'QUICK', true).frictionAligned).toBe(
      true
    );
  });
  it('frictionAligned=true when FULL + !frictionFree', () => {
    expect(computeRecommendationAxes('FULL', 'FULL', false).frictionAligned).toBe(
      true
    );
  });
  it('frictionAligned=false when QUICK + !frictionFree', () => {
    expect(computeRecommendationAxes('QUICK', 'QUICK', false).frictionAligned).toBe(
      false
    );
  });
  it('frictionAligned=false when FULL + frictionFree', () => {
    expect(computeRecommendationAxes('FULL', 'FULL', true).frictionAligned).toBe(
      false
    );
  });
});

describe('sumCostRange', () => {
  it('returns lower=baseline+marginal lower, upper=baseline+marginal upper', () => {
    expect(
      sumCostRange({
        baselineLower: 1.5,
        baselineUpper: 2.5,
        marginalLower: 0.5,
        marginalUpper: 1.5,
      })
    ).toEqual({ lower: 2, upper: 4 });
  });
  it('handles zero bounds', () => {
    expect(
      sumCostRange({
        baselineLower: 0,
        baselineUpper: 0,
        marginalLower: 0,
        marginalUpper: 0,
      })
    ).toEqual({ lower: 0, upper: 0 });
  });
});
