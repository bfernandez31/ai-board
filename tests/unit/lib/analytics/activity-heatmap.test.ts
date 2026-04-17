import { describe, expect, it } from 'vitest';
import {
  assignIntensity,
  bucketJobsByLocalDay,
  buildPeriodBounds,
  computeIntensityThresholds,
  resolveYearSelectorOptions,
} from '@/lib/analytics/activity-heatmap-helpers';

describe('buildPeriodBounds', () => {
  it('returns rolling 12 months ending today inclusive', () => {
    const now = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
    const bounds = buildPeriodBounds({ kind: 'rolling12m' }, now, 'UTC');
    expect(bounds.kind).toBe('rolling12m');
    expect(bounds.endDate).toBe('2026-04-17');
    expect(bounds.startDate).toBe('2025-04-18');
    expect(bounds.timezone).toBe('UTC');
  });

  it('returns calendar year boundaries', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const bounds = buildPeriodBounds({ kind: 'calendarYear', year: 2024 }, now, 'America/New_York');
    expect(bounds.kind).toBe('calendarYear');
    expect(bounds.year).toBe(2024);
    expect(bounds.startDate).toBe('2024-01-01');
    expect(bounds.endDate).toBe('2024-12-31');
    expect(bounds.timezone).toBe('America/New_York');
  });

  it('falls back to UTC on invalid timezone', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const bounds = buildPeriodBounds({ kind: 'rolling12m' }, now, 'Not/A_Zone');
    expect(bounds.timezone).toBe('UTC');
  });
});

describe('bucketJobsByLocalDay', () => {
  it('aggregates counts and sums non-null costs', () => {
    const jobs = [
      { startedAt: new Date('2025-06-12T10:00:00Z'), costUsd: 0.5 },
      { startedAt: new Date('2025-06-12T11:00:00Z'), costUsd: 0.25 },
      { startedAt: new Date('2025-06-12T12:00:00Z'), costUsd: null },
      { startedAt: new Date('2025-06-13T00:05:00Z'), costUsd: 1.0 },
    ];
    const buckets = bucketJobsByLocalDay(jobs, 'UTC');
    expect(buckets.get('2025-06-12')).toEqual({
      jobCount: 3,
      costSum: 0.75,
      nullCostJobCount: 1,
    });
    expect(buckets.get('2025-06-13')).toEqual({
      jobCount: 1,
      costSum: 1.0,
      nullCostJobCount: 0,
    });
  });

  it('keeps costSum null when all jobs have null cost', () => {
    const jobs = [
      { startedAt: new Date('2025-06-12T10:00:00Z'), costUsd: null },
      { startedAt: new Date('2025-06-12T11:00:00Z'), costUsd: null },
    ];
    const buckets = bucketJobsByLocalDay(jobs, 'UTC');
    expect(buckets.get('2025-06-12')).toEqual({
      jobCount: 2,
      costSum: null,
      nullCostJobCount: 2,
    });
  });

  it('respects timezone for day bucketing', () => {
    const jobs = [
      { startedAt: new Date('2025-06-12T03:00:00Z'), costUsd: 1 },
    ];
    const utc = bucketJobsByLocalDay(jobs, 'UTC');
    const la = bucketJobsByLocalDay(jobs, 'America/Los_Angeles');
    expect(utc.has('2025-06-12')).toBe(true);
    expect(la.has('2025-06-11')).toBe(true);
  });
});

describe('computeIntensityThresholds', () => {
  it('returns [0,0,0,0] when max is 0', () => {
    expect(computeIntensityThresholds(0)).toEqual([0, 0, 0, 0]);
  });

  it('splits quartiles with ceiling', () => {
    expect(computeIntensityThresholds(4)).toEqual([1, 2, 3, 4]);
    expect(computeIntensityThresholds(12)).toEqual([3, 6, 9, 12]);
  });

  it('always floors each non-zero threshold to >=1', () => {
    const t = computeIntensityThresholds(1);
    expect(t).toEqual([1, 1, 1, 1]);
  });
});

describe('assignIntensity', () => {
  it('returns 0 iff jobCount is 0', () => {
    expect(assignIntensity(0, [3, 6, 9, 12])).toBe(0);
    expect(assignIntensity(1, [3, 6, 9, 12])).toBe(1);
  });

  it('maps counts to levels 1..4 correctly', () => {
    const t: [number, number, number, number] = [3, 6, 9, 12];
    expect(assignIntensity(3, t)).toBe(1);
    expect(assignIntensity(4, t)).toBe(2);
    expect(assignIntensity(6, t)).toBe(2);
    expect(assignIntensity(9, t)).toBe(3);
    expect(assignIntensity(12, t)).toBe(4);
    expect(assignIntensity(100, t)).toBe(4);
  });
});

describe('resolveYearSelectorOptions', () => {
  it('returns empty when created this year', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const createdAt = new Date(Date.UTC(2026, 0, 2));
    expect(resolveYearSelectorOptions(createdAt, now)).toEqual({
      calendarYears: [],
      currentYear: 2026,
    });
  });

  it('returns descending year list for multi-year account', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const createdAt = new Date(Date.UTC(2023, 5, 1));
    expect(resolveYearSelectorOptions(createdAt, now)).toEqual({
      calendarYears: [2026, 2025, 2024, 2023],
      currentYear: 2026,
    });
  });

  it('clamps future-created clock-skew to current year', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const createdAt = new Date(Date.UTC(2030, 0, 1));
    expect(resolveYearSelectorOptions(createdAt, now)).toEqual({
      calendarYears: [],
      currentYear: 2026,
    });
  });
});
