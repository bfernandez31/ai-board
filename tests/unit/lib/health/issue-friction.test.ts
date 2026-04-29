import { describe, it, expect } from 'vitest';
import { frictionLevelForIssueCount } from '@/lib/health/issue-friction';

describe('frictionLevelForIssueCount', () => {
  it('returns null for null input', () => {
    expect(frictionLevelForIssueCount(null)).toBeNull();
  });

  it('returns "low" for 0', () => {
    expect(frictionLevelForIssueCount(0)).toBe('low');
  });

  it('returns "med" for 1', () => {
    expect(frictionLevelForIssueCount(1)).toBe('med');
  });

  it('returns "med" for 2', () => {
    expect(frictionLevelForIssueCount(2)).toBe('med');
  });

  it('returns "high" for 3', () => {
    expect(frictionLevelForIssueCount(3)).toBe('high');
  });

  it('returns "high" for 5', () => {
    expect(frictionLevelForIssueCount(5)).toBe('high');
  });

  it('returns null for negative input (-1)', () => {
    expect(frictionLevelForIssueCount(-1)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(frictionLevelForIssueCount(Infinity)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(frictionLevelForIssueCount(NaN)).toBeNull();
  });
});
