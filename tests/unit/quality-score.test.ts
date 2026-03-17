import { describe, it, expect } from 'vitest';
import {
  getQualityTier,
  getQualityTierConfig,
  QUALITY_DIMENSIONS,
} from '@/lib/utils/quality-score';

describe('getQualityTier', () => {
  it('returns excellent for scores >= 90', () => {
    expect(getQualityTier(90)).toBe('excellent');
    expect(getQualityTier(95)).toBe('excellent');
    expect(getQualityTier(100)).toBe('excellent');
  });

  it('returns good for scores 70-89', () => {
    expect(getQualityTier(70)).toBe('good');
    expect(getQualityTier(80)).toBe('good');
    expect(getQualityTier(89)).toBe('good');
  });

  it('returns fair for scores 50-69', () => {
    expect(getQualityTier(50)).toBe('fair');
    expect(getQualityTier(60)).toBe('fair');
    expect(getQualityTier(69)).toBe('fair');
  });

  it('returns poor for scores < 50', () => {
    expect(getQualityTier(0)).toBe('poor');
    expect(getQualityTier(25)).toBe('poor');
    expect(getQualityTier(49)).toBe('poor');
  });
});

describe('getQualityTierConfig', () => {
  it('returns correct config for each tier', () => {
    const excellent = getQualityTierConfig(95);
    expect(excellent.tier).toBe('excellent');
    expect(excellent.label).toBe('Excellent');
    expect(excellent.textColor).toContain('green');

    const good = getQualityTierConfig(75);
    expect(good.tier).toBe('good');
    expect(good.label).toBe('Good');
    expect(good.textColor).toContain('blue');

    const fair = getQualityTierConfig(55);
    expect(fair.tier).toBe('fair');
    expect(fair.label).toBe('Fair');

    const poor = getQualityTierConfig(30);
    expect(poor.tier).toBe('poor');
    expect(poor.label).toBe('Poor');
    expect(poor.textColor).toContain('destructive');
  });
});

describe('QUALITY_DIMENSIONS', () => {
  it('has 5 dimensions', () => {
    expect(Object.keys(QUALITY_DIMENSIONS)).toHaveLength(5);
  });

  it('weights sum to 100', () => {
    const totalWeight = Object.values(QUALITY_DIMENSIONS).reduce(
      (sum, dim) => sum + dim.weight,
      0
    );
    expect(totalWeight).toBe(100);
  });

  it('has correct weights per spec', () => {
    expect(QUALITY_DIMENSIONS.bugDetection.weight).toBe(30);
    expect(QUALITY_DIMENSIONS.compliance.weight).toBe(30);
    expect(QUALITY_DIMENSIONS.codeComments.weight).toBe(20);
    expect(QUALITY_DIMENSIONS.historicalContext.weight).toBe(10);
    expect(QUALITY_DIMENSIONS.previousPrComments.weight).toBe(10);
  });
});
