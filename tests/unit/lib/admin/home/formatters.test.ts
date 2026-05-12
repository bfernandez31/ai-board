import { describe, it, expect } from 'vitest';
import {
  formatPriceCents,
  formatDelta,
  formatPercent,
  formatCountWithSpacedThousands,
} from '@/app/lib/admin/home/formatters';

describe('formatPriceCents', () => {
  it('formats 1500 cents as €15.00', () => {
    expect(formatPriceCents(1500)).toBe('€15.00');
  });

  it('formats zero', () => {
    expect(formatPriceCents(0)).toBe('€0.00');
  });

  it('formats large amounts with thousands separator', () => {
    expect(formatPriceCents(123_456)).toBe('€1,234.56');
  });

  it('formats negative cents', () => {
    expect(formatPriceCents(-2500)).toBe('-€25.00');
  });
});

describe('formatDelta', () => {
  it('formats positive absolute delta with + sign', () => {
    expect(formatDelta({ label: 'Δ7j', value: 12, unit: 'absolute', goodDirection: 'up' })).toBe(
      '+12'
    );
  });

  it('formats negative absolute delta with minus sign', () => {
    expect(formatDelta({ label: 'Δ7j', value: -4, unit: 'absolute', goodDirection: 'up' })).toBe(
      '−4'
    );
  });

  it('formats zero absolute as "0"', () => {
    expect(formatDelta({ label: 'Δ7j', value: 0, unit: 'absolute', goodDirection: 'up' })).toBe(
      '0'
    );
  });

  it('formats positive percent delta with %', () => {
    expect(formatDelta({ label: 'Δ%', value: 0.12, unit: 'percent', goodDirection: 'up' })).toBe(
      '+12%'
    );
  });

  it('formats negative percent delta with minus sign and %', () => {
    expect(formatDelta({ label: 'Δ%', value: -0.04, unit: 'percent', goodDirection: 'up' })).toBe(
      '−4%'
    );
  });
});

describe('formatPercent', () => {
  it('formats a ratio as percent', () => {
    expect(formatPercent(0.84)).toBe('84%');
  });

  it('returns em-dash on null', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('returns em-dash on NaN (divide-by-zero)', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatCountWithSpacedThousands', () => {
  it('returns single digit unchanged', () => {
    expect(formatCountWithSpacedThousands(9)).toBe('9');
  });

  it('returns three-digit value unchanged', () => {
    expect(formatCountWithSpacedThousands(247)).toBe('247');
  });

  it('inserts spaces for thousands', () => {
    expect(formatCountWithSpacedThousands(1247)).toBe('1 247');
  });

  it('inserts spaces for millions', () => {
    expect(formatCountWithSpacedThousands(1_247_532)).toBe('1 247 532');
  });
});
