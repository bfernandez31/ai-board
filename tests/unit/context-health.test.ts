import { describe, it, expect } from 'vitest';
import {
  getContextHealthTier,
  CONTEXT_HEALTH_CONFIG,
  getContextSizeBucket,
  getQualityScoreBucket,
} from '@/lib/analytics/aggregations';

describe('getContextHealthTier', () => {
  it('returns healthy for peak below 50K', () => {
    expect(getContextHealthTier(0)).toBe('healthy');
    expect(getContextHealthTier(49999)).toBe('healthy');
  });

  it('returns warning at exactly 50K boundary', () => {
    expect(getContextHealthTier(50000)).toBe('warning');
  });

  it('returns warning for peak between 50K and 100K', () => {
    expect(getContextHealthTier(75000)).toBe('warning');
    expect(getContextHealthTier(99999)).toBe('warning');
  });

  it('returns danger at exactly 100K boundary', () => {
    expect(getContextHealthTier(100000)).toBe('danger');
  });

  it('returns danger for peak above 100K', () => {
    expect(getContextHealthTier(150000)).toBe('danger');
    expect(getContextHealthTier(200000)).toBe('danger');
  });
});

describe('CONTEXT_HEALTH_CONFIG', () => {
  it('has config for all tiers', () => {
    expect(CONTEXT_HEALTH_CONFIG.healthy).toBeDefined();
    expect(CONTEXT_HEALTH_CONFIG.warning).toBeDefined();
    expect(CONTEXT_HEALTH_CONFIG.danger).toBeDefined();
  });

  it('has distinct color classes', () => {
    const colors = new Set([
      CONTEXT_HEALTH_CONFIG.healthy.color,
      CONTEXT_HEALTH_CONFIG.warning.color,
      CONTEXT_HEALTH_CONFIG.danger.color,
    ]);
    expect(colors.size).toBe(3);
  });
});

describe('getContextSizeBucket', () => {
  it('returns correct buckets for boundary values', () => {
    expect(getContextSizeBucket(0)).toBe('0–25K');
    expect(getContextSizeBucket(24999)).toBe('0–25K');
    expect(getContextSizeBucket(25000)).toBe('25–50K');
    expect(getContextSizeBucket(49999)).toBe('25–50K');
    expect(getContextSizeBucket(50000)).toBe('50–75K');
    expect(getContextSizeBucket(74999)).toBe('50–75K');
    expect(getContextSizeBucket(75000)).toBe('75–100K');
    expect(getContextSizeBucket(99999)).toBe('75–100K');
    expect(getContextSizeBucket(100000)).toBe('100–150K');
    expect(getContextSizeBucket(149999)).toBe('100–150K');
    expect(getContextSizeBucket(150000)).toBe('150K+');
    expect(getContextSizeBucket(500000)).toBe('150K+');
  });
});

describe('getQualityScoreBucket', () => {
  it('returns correct buckets for boundary values', () => {
    expect(getQualityScoreBucket(100)).toBe('Excellent');
    expect(getQualityScoreBucket(90)).toBe('Excellent');
    expect(getQualityScoreBucket(89)).toBe('Good');
    expect(getQualityScoreBucket(70)).toBe('Good');
    expect(getQualityScoreBucket(69)).toBe('Fair');
    expect(getQualityScoreBucket(50)).toBe('Fair');
    expect(getQualityScoreBucket(49)).toBe('Poor');
    expect(getQualityScoreBucket(30)).toBe('Poor');
    expect(getQualityScoreBucket(29)).toBe('Critical');
    expect(getQualityScoreBucket(0)).toBe('Critical');
  });
});
