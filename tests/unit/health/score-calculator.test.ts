import { describe, it, expect } from 'vitest';
import { calculateGlobalScore } from '@/lib/health/score-calculator';

describe('calculateGlobalScore', () => {
  it('returns null when no modules have scores', () => {
    expect(calculateGlobalScore({})).toBeNull();
  });

  it('returns null when all scores are null', () => {
    expect(
      calculateGlobalScore({
        SECURITY: null,
        COMPLIANCE: null,
        TESTS: null,
        SPEC_SYNC: null,
        QUALITY_GATE: null,
      })
    ).toBeNull();
  });

  it('returns the score directly when only one module has a score', () => {
    expect(calculateGlobalScore({ SECURITY: 80 })).toBe(80);
  });

  it('calculates equal weight average for all 5 contributing modules', () => {
    const result = calculateGlobalScore({
      SECURITY: 90,
      COMPLIANCE: 80,
      TESTS: 70,
      SPEC_SYNC: 60,
      QUALITY_GATE: 50,
    });
    // (90 + 80 + 70 + 60 + 50) / 5 = 70
    expect(result).toBe(70);
  });

  it('redistributes weight when some modules are missing', () => {
    const result = calculateGlobalScore({
      SECURITY: 90,
      TESTS: 70,
    });
    // (90 + 70) / 2 = 80
    expect(result).toBe(80);
  });

  it('ignores non-contributing module keys', () => {
    const result = calculateGlobalScore({
      SECURITY: 100,
      LAST_CLEAN: 50,
    });
    // Only SECURITY counts (LAST_CLEAN is not a contributing key)
    expect(result).toBe(100);
  });

  it('rounds to nearest integer', () => {
    const result = calculateGlobalScore({
      SECURITY: 91,
      COMPLIANCE: 82,
      TESTS: 73,
    });
    // (91 + 82 + 73) / 3 = 82
    expect(result).toBe(82);
  });

  it('handles all zero scores', () => {
    expect(
      calculateGlobalScore({
        SECURITY: 0,
        COMPLIANCE: 0,
        TESTS: 0,
        SPEC_SYNC: 0,
        QUALITY_GATE: 0,
      })
    ).toBe(0);
  });

  it('handles all perfect scores', () => {
    expect(
      calculateGlobalScore({
        SECURITY: 100,
        COMPLIANCE: 100,
        TESTS: 100,
        SPEC_SYNC: 100,
        QUALITY_GATE: 100,
      })
    ).toBe(100);
  });

  it('handles mix of null and present scores', () => {
    const result = calculateGlobalScore({
      SECURITY: 80,
      COMPLIANCE: null,
      TESTS: 60,
      SPEC_SYNC: null,
      QUALITY_GATE: null,
    });
    // (80 + 60) / 2 = 70
    expect(result).toBe(70);
  });
});
