import { describe, it, expect } from 'vitest';
import {
  classifyJobByCommand,
  aggregateJobCounts,
  RULE_SET_VERSION,
} from '@/lib/outcomes/classification';

describe('classifyJobByCommand', () => {
  it('classifies iterate as friction', () => {
    expect(classifyJobByCommand('iterate')).toBe('friction');
  });

  it('classifies iterate-something as friction', () => {
    expect(classifyJobByCommand('iterate-something')).toBe('friction');
  });

  it('classifies comment-build as friction', () => {
    expect(classifyJobByCommand('comment-build')).toBe('friction');
  });

  it('classifies comment-specify as friction', () => {
    expect(classifyJobByCommand('comment-specify')).toBe('friction');
  });

  it('classifies specify as pipeline', () => {
    expect(classifyJobByCommand('specify')).toBe('pipeline');
  });

  it('classifies plan as pipeline', () => {
    expect(classifyJobByCommand('plan')).toBe('pipeline');
  });

  it('classifies verify as pipeline', () => {
    expect(classifyJobByCommand('verify')).toBe('pipeline');
  });

  it('classifies health-scan as pipeline', () => {
    expect(classifyJobByCommand('health-scan')).toBe('pipeline');
  });

  it('handles empty command as pipeline', () => {
    expect(classifyJobByCommand('')).toBe('pipeline');
  });

  it('handles null command as pipeline', () => {
    expect(classifyJobByCommand(null)).toBe('pipeline');
  });

  it('does NOT misclassify a literal "iterates" command as friction', () => {
    // We require startsWith iterate plus '-' or exact match.
    // "iterates" should still be pipeline.
    expect(classifyJobByCommand('iterates')).toBe('pipeline');
  });
});

describe('aggregateJobCounts', () => {
  it('preserves the invariant pipeline + friction === total', () => {
    const jobs = [
      { command: 'specify' },
      { command: 'plan' },
      { command: 'iterate' },
      { command: 'comment-build' },
      { command: 'verify' },
    ];
    const result = aggregateJobCounts(jobs);
    expect(result.pipelineJobCount + result.frictionJobCount).toBe(result.totalJobCount);
    expect(result.totalJobCount).toBe(5);
    expect(result.pipelineJobCount).toBe(3);
    expect(result.frictionJobCount).toBe(2);
  });

  it('builds a per-command frequency map', () => {
    const jobs = [
      { command: 'specify' },
      { command: 'iterate' },
      { command: 'iterate' },
      { command: 'comment-build' },
    ];
    const result = aggregateJobCounts(jobs);
    expect(result.jobCountByPrefix).toEqual({
      specify: 1,
      iterate: 2,
      'comment-build': 1,
    });
  });

  it('returns zeros for empty jobs list', () => {
    const result = aggregateJobCounts([]);
    expect(result).toEqual({
      pipelineJobCount: 0,
      frictionJobCount: 0,
      totalJobCount: 0,
      jobCountByPrefix: {},
    });
  });

  it('treats null command as unknown bucket', () => {
    const result = aggregateJobCounts([{ command: null }]);
    expect(result.jobCountByPrefix).toEqual({ unknown: 1 });
    expect(result.pipelineJobCount).toBe(1);
  });
});

describe('RULE_SET_VERSION', () => {
  it('is pinned to 1', () => {
    expect(RULE_SET_VERSION).toBe(1);
  });
});
