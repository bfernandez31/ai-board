import { describe, it, expect } from 'vitest';
import { classifyJob, computeJobSignals } from '@/lib/outcomes/jobs';

describe('classifyJob', () => {
  it('classifies pipeline commands', () => {
    expect(classifyJob('specify')).toBe('pipeline');
    expect(classifyJob('plan')).toBe('pipeline');
    expect(classifyJob('implement')).toBe('pipeline');
    expect(classifyJob('quick-impl')).toBe('pipeline');
    expect(classifyJob('verify')).toBe('pipeline');
    expect(classifyJob('ship')).toBe('pipeline');
  });

  it('classifies iterate runs as friction', () => {
    expect(classifyJob('iterate')).toBe('friction');
  });

  it('classifies all comment-* commands as friction', () => {
    expect(classifyJob('comment-specify')).toBe('friction');
    expect(classifyJob('comment-plan')).toBe('friction');
    expect(classifyJob('comment-build')).toBe('friction');
    expect(classifyJob('comment-verify')).toBe('friction');
    expect(classifyJob('comment-ship')).toBe('friction');
  });

  it('classifies infrastructure commands separately from pipeline/friction', () => {
    expect(classifyJob('deploy-preview')).toBe('infrastructure');
    expect(classifyJob('rollback-reset')).toBe('infrastructure');
    expect(classifyJob('health-scan')).toBe('infrastructure');
  });

  it('treats unknown commands as infrastructure (neither pipeline nor friction)', () => {
    expect(classifyJob('experimental-thing')).toBe('infrastructure');
  });
});

type J = Parameters<typeof computeJobSignals>[0]['jobs'][number];

function job(overrides: Partial<J>): J {
  return {
    command: 'specify',
    status: 'COMPLETED',
    costUsd: null,
    durationMs: null,
    qualityScore: null,
    ...overrides,
  } as J;
}

describe('computeJobSignals', () => {
  it('aggregates cost and duration across all jobs (including infrastructure)', () => {
    const signals = computeJobSignals({
      jobs: [
        job({ command: 'specify', costUsd: 0.1, durationMs: 1000 }),
        job({ command: 'iterate', costUsd: 0.2, durationMs: 2000 }),
        job({ command: 'deploy-preview', costUsd: 0.05, durationMs: 500 }),
      ],
    });
    expect(signals.totalCostUsd).toBeCloseTo(0.35, 5);
    expect(signals.totalDurationMs).toBe(3500);
  });

  it('counts pipeline and friction jobs separately and excludes infrastructure', () => {
    const signals = computeJobSignals({
      jobs: [
        job({ command: 'specify' }),
        job({ command: 'plan' }),
        job({ command: 'implement' }),
        job({ command: 'verify' }),
        job({ command: 'iterate' }),
        job({ command: 'comment-build' }),
        job({ command: 'deploy-preview' }),
      ],
    });
    expect(signals.pipelineJobCount).toBe(4);
    expect(signals.frictionJobCount).toBe(2);
  });

  it('handles missing telemetry without crashing', () => {
    const signals = computeJobSignals({
      jobs: [
        job({ command: 'specify' }),
        job({ command: 'verify', qualityScore: 87 }),
      ],
    });
    expect(signals.totalCostUsd).toBe(0);
    expect(signals.totalDurationMs).toBe(0);
    expect(signals.finalQualityScore).toBe(87);
  });

  it('picks the most recent COMPLETED verify-class job for finalQualityScore', () => {
    const signals = computeJobSignals({
      jobs: [
        job({ command: 'verify', qualityScore: 70 }),
        job({ command: 'iterate', qualityScore: 92 }),
      ],
    });
    expect(signals.finalQualityScore).toBe(92);
  });

  it('skips non-COMPLETED jobs when picking finalQualityScore', () => {
    const signals = computeJobSignals({
      jobs: [
        job({ command: 'verify', status: 'COMPLETED', qualityScore: 70 }),
        job({ command: 'iterate', status: 'FAILED', qualityScore: 30 }),
      ],
    });
    expect(signals.finalQualityScore).toBe(70);
  });

  it('returns null finalQualityScore when no verify-class jobs are present', () => {
    const signals = computeJobSignals({
      jobs: [job({ command: 'quick-impl', qualityScore: null })],
    });
    expect(signals.finalQualityScore).toBeNull();
  });
});
