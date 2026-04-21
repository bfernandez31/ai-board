import { describe, expect, it } from 'vitest';
import {
  enumerateYearsSinceJoin,
  getPeriodBoundaries,
  parsePeriodParam,
  resolvePeriod,
  serializePeriodParam,
} from '@/lib/heatmap/period';

describe('parsePeriodParam / serializePeriodParam', () => {
  const now = new Date('2026-04-21T12:00:00Z');
  const joinYear = 2023;

  it('returns default on undefined / empty', () => {
    expect(parsePeriodParam(undefined, joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
    expect(parsePeriodParam('', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
    expect(parsePeriodParam(null, joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
  });

  it('parses 12m as rolling', () => {
    expect(parsePeriodParam('12m', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
  });

  it('parses valid year within bounds', () => {
    expect(parsePeriodParam('2024', joinYear, now)).toEqual({ kind: 'year', year: 2024 });
    expect(parsePeriodParam('2026', joinYear, now)).toEqual({ kind: 'year', year: 2026 });
  });

  it('falls back to default for year before joinYear', () => {
    expect(parsePeriodParam('2019', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
  });

  it('falls back to default for future year', () => {
    expect(parsePeriodParam('2099', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
  });

  it('falls back to default for garbage input', () => {
    expect(parsePeriodParam('abc', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
    expect(parsePeriodParam('123', joinYear, now)).toEqual({ kind: 'rolling', months: 12 });
  });

  it('round-trips rolling', () => {
    const p = parsePeriodParam('12m', joinYear, now);
    expect(serializePeriodParam(p)).toBe('12m');
  });

  it('round-trips year', () => {
    const p = parsePeriodParam('2025', joinYear, now);
    expect(serializePeriodParam(p)).toBe('2025');
  });
});

describe('resolvePeriod', () => {
  const now = new Date('2026-04-21T12:00:00Z');

  it('returns rolling unchanged', () => {
    expect(resolvePeriod({ kind: 'rolling', months: 12 }, 2023, now)).toEqual({
      kind: 'rolling',
      months: 12,
    });
  });

  it('returns year when within bounds', () => {
    expect(resolvePeriod({ kind: 'year', year: 2024 }, 2023, now)).toEqual({
      kind: 'year',
      year: 2024,
    });
  });

  it('falls back when year before join', () => {
    expect(resolvePeriod({ kind: 'year', year: 2000 }, 2023, now)).toEqual({
      kind: 'rolling',
      months: 12,
    });
  });

  it('falls back when year in future', () => {
    expect(resolvePeriod({ kind: 'year', year: 2099 }, 2023, now)).toEqual({
      kind: 'rolling',
      months: 12,
    });
  });
});

describe('getPeriodBoundaries', () => {
  it('computes rolling 12-month window ending today', () => {
    const now = new Date('2026-04-21T12:00:00Z');
    const b = getPeriodBoundaries({ kind: 'rolling', months: 12 }, now);
    expect(b.label).toBe('the last year');
    expect(b.endDate.getUTCFullYear()).toBe(2026);
    expect(b.endDate.getUTCMonth()).toBe(3);
    expect(b.endDate.getUTCDate()).toBe(21);
    expect(b.startDate.getUTCFullYear()).toBe(2025);
    expect(b.startDate.getUTCMonth()).toBe(3);
    expect(b.startDate.getUTCDate()).toBe(22);
  });

  it('clamps year endDate to today for current year', () => {
    const now = new Date('2026-04-21T12:00:00Z');
    const b = getPeriodBoundaries({ kind: 'year', year: 2026 }, now);
    expect(b.startDate.getUTCFullYear()).toBe(2026);
    expect(b.startDate.getUTCMonth()).toBe(0);
    expect(b.startDate.getUTCDate()).toBe(1);
    expect(b.endDate.getUTCMonth()).toBeLessThanOrEqual(3);
    expect(b.endDate.getTime()).toBeLessThanOrEqual(
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
      ).getTime()
    );
    expect(b.label).toBe('2026');
  });

  it('uses full year for past year', () => {
    const now = new Date('2026-04-21T12:00:00Z');
    const b = getPeriodBoundaries({ kind: 'year', year: 2024 }, now);
    expect(b.startDate.toISOString().split('T')[0]).toBe('2024-01-01');
    expect(b.endDate.toISOString().split('T')[0]).toBe('2024-12-31');
    expect(b.label).toBe('2024');
  });
});

describe('enumerateYearsSinceJoin', () => {
  const now = new Date('2026-04-21T12:00:00Z');

  it('returns reverse-chrono list when join year < current year', () => {
    expect(enumerateYearsSinceJoin(2023, now)).toEqual([2026, 2025, 2024, 2023]);
  });

  it('returns empty list when user joined this calendar year', () => {
    expect(enumerateYearsSinceJoin(2026, now)).toEqual([]);
  });

  it('returns empty list when joinYear is impossibly in the future', () => {
    expect(enumerateYearsSinceJoin(2099, now)).toEqual([]);
  });

  it('places current year first and join year last (earliest=join, latest=current)', () => {
    const years = enumerateYearsSinceJoin(2022, now);
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(2022);
  });

  it('returns a descending sequence with no duplicates', () => {
    const years = enumerateYearsSinceJoin(2020, now);
    for (let i = 1; i < years.length; i += 1) {
      expect(years[i]!).toBe(years[i - 1]! - 1);
    }
    expect(new Set(years).size).toBe(years.length);
  });
});
