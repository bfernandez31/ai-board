import { describe, expect, it } from 'vitest';
import { formatCost, formatTokens, formatDuration } from '@/lib/health/format';

describe('formatCost', () => {
  it('formats cost with 2 decimal places', () => {
    expect(formatCost(0.42)).toBe('$0.42');
  });

  it('formats whole numbers with trailing zeros', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });

  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('returns plain number for values under 1000', () => {
    expect(formatTokens(500)).toBe('500');
  });

  it('abbreviates thousands with k suffix', () => {
    expect(formatTokens(1200)).toBe('1.2k');
  });

  it('abbreviates millions with M suffix', () => {
    expect(formatTokens(1500000)).toBe('1.5M');
  });

  it('handles exact thousand', () => {
    expect(formatTokens(1000)).toBe('1.0k');
  });

  it('handles exact million', () => {
    expect(formatTokens(1000000)).toBe('1.0M');
  });
});

describe('formatDuration', () => {
  it('formats sub-second as fractional seconds', () => {
    expect(formatDuration(500)).toBe('0.5s');
  });

  it('formats seconds with one decimal', () => {
    expect(formatDuration(2300)).toBe('2.3s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(75000)).toBe('1m 15s');
  });

  it('formats exact minutes without seconds', () => {
    expect(formatDuration(120000)).toBe('2m');
  });
});
