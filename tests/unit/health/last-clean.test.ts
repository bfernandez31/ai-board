import { describe, expect, it } from 'vitest';
import { computeStalenessStatus, parseCleanupOutput } from '@/lib/health/last-clean';

describe('computeStalenessStatus', () => {
  it('returns null when daysSinceClean is null', () => {
    expect(computeStalenessStatus(null)).toBeNull();
  });

  it('returns "ok" when less than 30 days', () => {
    expect(computeStalenessStatus(0)).toBe('ok');
    expect(computeStalenessStatus(10)).toBe('ok');
    expect(computeStalenessStatus(29)).toBe('ok');
  });

  it('returns "warning" at exactly 30 days', () => {
    expect(computeStalenessStatus(30)).toBe('warning');
  });

  it('returns "warning" between 30 and 60 days', () => {
    expect(computeStalenessStatus(45)).toBe('warning');
    expect(computeStalenessStatus(60)).toBe('warning');
  });

  it('returns "alert" beyond 60 days', () => {
    expect(computeStalenessStatus(61)).toBe('alert');
    expect(computeStalenessStatus(90)).toBe('alert');
    expect(computeStalenessStatus(365)).toBe('alert');
  });
});

describe('parseCleanupOutput', () => {
  it('returns nulls for null output', () => {
    expect(parseCleanupOutput(null)).toEqual({
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
    });
  });

  it('returns nulls for empty string', () => {
    expect(parseCleanupOutput('')).toEqual({
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
    });
  });

  it('returns nulls for non-JSON output', () => {
    expect(parseCleanupOutput('Cleanup completed successfully')).toEqual({
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
    });
  });

  it('parses structured JSON output with all fields', () => {
    const output = JSON.stringify({
      filesCleaned: 12,
      remainingIssues: 3,
      summary: 'Cleaned 12 files, 3 remaining issues',
    });
    expect(parseCleanupOutput(output)).toEqual({
      filesCleaned: 12,
      remainingIssues: 3,
      summary: 'Cleaned 12 files, 3 remaining issues',
    });
  });

  it('handles partial JSON with only some fields', () => {
    const output = JSON.stringify({ filesCleaned: 5 });
    expect(parseCleanupOutput(output)).toEqual({
      filesCleaned: 5,
      remainingIssues: null,
      summary: null,
    });
  });

  it('returns null for wrong types in JSON', () => {
    const output = JSON.stringify({
      filesCleaned: 'twelve',
      remainingIssues: true,
      summary: 42,
    });
    expect(parseCleanupOutput(output)).toEqual({
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
    });
  });
});
