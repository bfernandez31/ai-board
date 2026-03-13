import { describe, expect, it } from 'vitest';
import { getPeriodLabel, normalizeAnalyticsQueryState } from '@/lib/analytics/types';

describe('analytics filter state helpers', () => {
  it('normalizes invalid filter values to defaults', () => {
    expect(
      normalizeAnalyticsQueryState({
        range: 'invalid',
        statusScope: 'bad',
        agentScope: 'wat',
      })
    ).toEqual({
      range: '30d',
      statusScope: 'shipped',
      agentScope: 'all',
    });
  });

  it('preserves valid filter values', () => {
    expect(
      normalizeAnalyticsQueryState({
        range: '7d',
        statusScope: 'closed',
        agentScope: 'CODEX',
      })
    ).toEqual({
      range: '7d',
      statusScope: 'closed',
      agentScope: 'CODEX',
    });
  });

  it('returns user-facing period labels', () => {
    expect(getPeriodLabel('7d')).toBe('Last 7 days');
    expect(getPeriodLabel('30d')).toBe('Last 30 days');
    expect(getPeriodLabel('90d')).toBe('Last 90 days');
    expect(getPeriodLabel('all')).toBe('All time');
  });
});
