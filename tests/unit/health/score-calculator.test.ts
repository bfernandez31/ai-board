import { describe, expect, it } from 'vitest';
import { calculateGlobalScore, getScoreLabel, getScoreColorConfig } from '@/lib/health/score-calculator';

describe('calculateGlobalScore', () => {
  it('returns null when no modules have scores', () => {
    expect(calculateGlobalScore({
      securityScore: null,
      complianceScore: null,
      testsScore: null,
      specSyncScore: null,
      qualityGate: null,
    })).toBeNull();
  });

  it('returns the single module score when only one module is scanned', () => {
    expect(calculateGlobalScore({
      securityScore: 80,
      complianceScore: null,
      testsScore: null,
      specSyncScore: null,
      qualityGate: null,
    })).toBe(80);
  });

  it('averages two module scores with equal weight', () => {
    expect(calculateGlobalScore({
      securityScore: 80,
      complianceScore: 60,
      testsScore: null,
      specSyncScore: null,
      qualityGate: null,
    })).toBe(70);
  });

  it('averages all 5 modules with equal weight', () => {
    expect(calculateGlobalScore({
      securityScore: 100,
      complianceScore: 80,
      testsScore: 60,
      specSyncScore: 40,
      qualityGate: 20,
    })).toBe(60);
  });

  it('rounds the result to nearest integer', () => {
    expect(calculateGlobalScore({
      securityScore: 33,
      complianceScore: 67,
      testsScore: null,
      specSyncScore: null,
      qualityGate: null,
    })).toBe(50);
  });

  it('handles all modules scoring 0', () => {
    expect(calculateGlobalScore({
      securityScore: 0,
      complianceScore: 0,
      testsScore: 0,
      specSyncScore: 0,
      qualityGate: 0,
    })).toBe(0);
  });

  it('handles all modules scoring 100', () => {
    expect(calculateGlobalScore({
      securityScore: 100,
      complianceScore: 100,
      testsScore: 100,
      specSyncScore: 100,
      qualityGate: 100,
    })).toBe(100);
  });
});

describe('getScoreLabel', () => {
  it('returns "No data yet" for null score', () => {
    expect(getScoreLabel(null)).toBe('No data yet');
  });

  it('returns "Excellent" for score >= 90', () => {
    expect(getScoreLabel(90)).toBe('Excellent');
    expect(getScoreLabel(100)).toBe('Excellent');
  });

  it('returns "Good" for score 70-89', () => {
    expect(getScoreLabel(70)).toBe('Good');
    expect(getScoreLabel(89)).toBe('Good');
  });

  it('returns "Fair" for score 50-69', () => {
    expect(getScoreLabel(50)).toBe('Fair');
    expect(getScoreLabel(69)).toBe('Fair');
  });

  it('returns "Poor" for score 0-49', () => {
    expect(getScoreLabel(0)).toBe('Poor');
    expect(getScoreLabel(49)).toBe('Poor');
  });
});

describe('getScoreColorConfig', () => {
  it('returns muted colors for null score', () => {
    const color = getScoreColorConfig(null);
    expect(color.text).toBe('text-muted-foreground');
    expect(color.bg).toBe('bg-muted');
    expect(color.fill).toBe('bg-muted');
  });

  it('returns green colors for excellent scores', () => {
    const color = getScoreColorConfig(95);
    expect(color.text).toBe('text-ctp-green');
  });

  it('returns blue colors for good scores', () => {
    const color = getScoreColorConfig(75);
    expect(color.text).toBe('text-ctp-blue');
  });

  it('returns yellow colors for fair scores', () => {
    const color = getScoreColorConfig(55);
    expect(color.text).toBe('text-ctp-yellow');
  });

  it('returns red colors for poor scores', () => {
    const color = getScoreColorConfig(30);
    expect(color.text).toBe('text-ctp-red');
  });
});
