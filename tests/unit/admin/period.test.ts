import { describe, it, expect } from 'vitest';
import { derivePeriod } from '@/lib/admin/insights/period';

describe('derivePeriod', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');

  it('returns NO_CLAUDE_WORK_YET when neither previous nor earliest is set', () => {
    const result = derivePeriod({
      previousHighWater: null,
      earliestClaudeStartedAt: null,
      now,
    });
    expect(result).toEqual({ error: 'NO_CLAUDE_WORK_YET' });
  });

  it('first-ever-run uses earliestClaudeStartedAt as periodStart', () => {
    const earliest = new Date('2026-04-01T08:00:00.000Z');
    const result = derivePeriod({
      previousHighWater: null,
      earliestClaudeStartedAt: earliest,
      now,
    });
    expect(result).toEqual({ periodStart: earliest, periodEnd: now });
  });

  it('incremental run uses previousHighWater as periodStart', () => {
    const previous = new Date('2026-05-01T00:00:00.000Z');
    const earliest = new Date('2026-04-01T08:00:00.000Z');
    const result = derivePeriod({
      previousHighWater: previous,
      earliestClaudeStartedAt: earliest,
      now,
    });
    expect(result).toEqual({ periodStart: previous, periodEnd: now });
  });

  it('previousHighWater takes precedence over earliestClaudeStartedAt', () => {
    const previous = new Date('2026-05-01T00:00:00.000Z');
    const result = derivePeriod({
      previousHighWater: previous,
      earliestClaudeStartedAt: null,
      now,
    });
    expect(result).toEqual({ periodStart: previous, periodEnd: now });
  });
});
