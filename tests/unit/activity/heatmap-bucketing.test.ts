import { describe, expect, it } from 'vitest';
import {
  type BucketJobInput,
  bucketJobsByLocalDay,
  buildAgentOptions,
  buildGridSkeleton,
  buildYearOptions,
  computeYearRange,
  getIntensityClass,
  getIntensityLevel,
} from '@/lib/activity/heatmap-bucketing';
import type { Agent } from '@prisma/client';

function makeJob(overrides: Partial<BucketJobInput> = {}): BucketJobInput {
  return {
    completedAt: new Date('2025-06-15T12:00:00Z'),
    ticketId: 1,
    command: 'implement',
    status: 'COMPLETED',
    costUsd: 0.5,
    ...overrides,
  };
}

describe('getIntensityLevel', () => {
  it('returns 0 for no jobs', () => {
    expect(getIntensityLevel(0)).toBe(0);
  });

  it('returns 1 for a single job', () => {
    expect(getIntensityLevel(1)).toBe(1);
  });

  it('returns 2 for 2-3 jobs', () => {
    expect(getIntensityLevel(2)).toBe(2);
    expect(getIntensityLevel(3)).toBe(2);
  });

  it('returns 3 for 4-7 jobs', () => {
    expect(getIntensityLevel(4)).toBe(3);
    expect(getIntensityLevel(7)).toBe(3);
  });

  it('returns 4 for 8+ jobs', () => {
    expect(getIntensityLevel(8)).toBe(4);
    expect(getIntensityLevel(100)).toBe(4);
  });
});

describe('getIntensityClass', () => {
  it('returns full literal class strings for each level', () => {
    expect(getIntensityClass(0)).toBe('aurora-cell-0');
    expect(getIntensityClass(1)).toBe('aurora-cell-1');
    expect(getIntensityClass(2)).toBe('aurora-cell-2');
    expect(getIntensityClass(3)).toBe('aurora-cell-3');
    expect(getIntensityClass(4)).toBe('aurora-cell-4');
  });
});

describe('bucketJobsByLocalDay', () => {
  it('buckets jobs into local days per IANA timezone (PST vs EST)', () => {
    // 2025-06-16T05:30Z is still 2025-06-15 in PST, but 2025-06-16 in EST (01:30 EDT)
    const job = makeJob({ completedAt: new Date('2025-06-16T05:30:00Z') });

    const pstDays = bucketJobsByLocalDay([job], 'America/Los_Angeles', {
      startDate: '2025-06-14',
      endDate: '2025-06-17',
    });
    const estDays = bucketJobsByLocalDay([job], 'America/New_York', {
      startDate: '2025-06-14',
      endDate: '2025-06-17',
    });

    const pstActive = pstDays.find((d) => d.jobCount > 0);
    const estActive = estDays.find((d) => d.jobCount > 0);

    expect(pstActive?.date).toBe('2025-06-15');
    expect(estActive?.date).toBe('2025-06-16');
  });

  it('omits totalCostUsd when all jobs for the day have null cost', () => {
    const jobs = [
      makeJob({ completedAt: new Date('2025-06-15T12:00:00Z'), costUsd: null }),
      makeJob({
        ticketId: 2,
        completedAt: new Date('2025-06-15T13:00:00Z'),
        costUsd: null,
      }),
    ];
    const days = bucketJobsByLocalDay(jobs, 'UTC', {
      startDate: '2025-06-15',
      endDate: '2025-06-15',
    });

    expect(days[0].jobCount).toBe(2);
    expect('totalCostUsd' in days[0]).toBe(false);
  });

  it('includes totalCostUsd when at least one job had cost', () => {
    const jobs = [
      makeJob({ completedAt: new Date('2025-06-15T12:00:00Z'), costUsd: null }),
      makeJob({
        ticketId: 2,
        completedAt: new Date('2025-06-15T13:00:00Z'),
        costUsd: 1.42,
      }),
    ];
    const days = bucketJobsByLocalDay(jobs, 'UTC', {
      startDate: '2025-06-15',
      endDate: '2025-06-15',
    });
    expect(days[0].totalCostUsd).toBe(1.42);
  });

  it('counts shipped tickets only for ship-command COMPLETED jobs', () => {
    const jobs = [
      makeJob({
        ticketId: 1,
        command: 'ship',
        status: 'COMPLETED',
        completedAt: new Date('2025-06-15T12:00:00Z'),
      }),
      makeJob({
        ticketId: 1,
        command: 'ship',
        status: 'FAILED',
        completedAt: new Date('2025-06-15T13:00:00Z'),
      }),
      makeJob({
        ticketId: 2,
        command: 'implement',
        status: 'COMPLETED',
        completedAt: new Date('2025-06-15T14:00:00Z'),
      }),
    ];

    const days = bucketJobsByLocalDay(jobs, 'UTC', {
      startDate: '2025-06-15',
      endDate: '2025-06-15',
    });
    expect(days[0].jobCount).toBe(3);
    expect(days[0].ticketsShipped).toBe(1);
  });

  it('produces contiguous days across the range even when empty', () => {
    const days = bucketJobsByLocalDay([], 'UTC', {
      startDate: '2025-06-14',
      endDate: '2025-06-17',
    });
    expect(days.map((d) => d.date)).toEqual([
      '2025-06-14',
      '2025-06-15',
      '2025-06-16',
      '2025-06-17',
    ]);
    for (const day of days) {
      expect(day.jobCount).toBe(0);
      expect(day.ticketsShipped).toBe(0);
      expect(day.intensity).toBe(0);
      expect('totalCostUsd' in day).toBe(false);
    }
  });
});

describe('buildGridSkeleton', () => {
  it('pads top-left when year starts on a day other than Sunday (2024 starts Monday)', () => {
    const range = buildGridSkeleton('2024-01-01', '2024-12-31');
    // 2024-01-01 is Monday → Sunday on/before is 2023-12-31
    expect(range.gridStart).toBe('2023-12-31');
  });

  it('pads bottom-right when year ends mid-week (2025-12-31 is a Wednesday)', () => {
    const range = buildGridSkeleton('2025-01-01', '2025-12-31');
    // 2025-12-31 is Wednesday → Saturday on/after is 2026-01-03
    expect(range.gridEnd).toBe('2026-01-03');
  });

  it('produces exact bounds when start is Sunday and end is Saturday', () => {
    // 2024-01-07 is Sunday, 2024-01-13 is Saturday
    const range = buildGridSkeleton('2024-01-07', '2024-01-13');
    expect(range.gridStart).toBe('2024-01-07');
    expect(range.gridEnd).toBe('2024-01-13');
  });
});

describe('buildYearOptions', () => {
  it('returns only "Last 12 months" for current-year account', () => {
    const now = new Date('2026-04-17T00:00:00Z');
    const created = new Date('2026-02-01T00:00:00Z');
    const options = buildYearOptions(created, now);
    expect(options.map((o) => o.value)).toEqual(['last-12-months']);
  });

  it('returns "Last 12 months" + descending years back to creation year', () => {
    const now = new Date('2026-04-17T00:00:00Z');
    const created = new Date('2023-03-20T00:00:00Z');
    const options = buildYearOptions(created, now);
    expect(options.map((o) => o.value)).toEqual([
      'last-12-months',
      '2026',
      '2025',
      '2024',
      '2023',
    ]);
    expect(options[0].isDefault).toBe(true);
  });
});

describe('buildAgentOptions', () => {
  it('includes all-agents aggregate plus only agents with non-zero history', () => {
    const counts = new Map<Agent, number>([
      ['CLAUDE' as Agent, 50],
      ['CODEX' as Agent, 0],
      ['MISTRAL' as Agent, 10],
      ['GEMINI' as Agent, 0],
    ]);
    const options = buildAgentOptions(counts);
    expect(options.map((o) => o.value)).toEqual(['all', 'CLAUDE', 'MISTRAL']);
    expect(options[0].historicalJobCount).toBe(60);
  });
});

describe('computeYearRange', () => {
  it('returns rolling year for last-12-months', () => {
    const now = new Date('2026-04-17T00:00:00Z');
    const range = computeYearRange('last-12-months', now);
    expect(range.endDate).toBe('2026-04-17');
    expect(range.startDate).toBe('2025-04-17');
  });

  it('returns Jan 1 through Dec 31 for a calendar year', () => {
    const now = new Date('2026-04-17T00:00:00Z');
    const range = computeYearRange('2025', now);
    expect(range).toEqual({ startDate: '2025-01-01', endDate: '2025-12-31' });
  });
});
