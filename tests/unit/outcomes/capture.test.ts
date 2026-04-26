import { describe, it, expect } from 'vitest';
import { _testing } from '@/lib/outcomes/capture';

const { buildPartialOutcome, readProjectStackConfig } = _testing;

describe('buildPartialOutcome', () => {
  const baseInput = {
    ticketId: 1,
    projectId: 7,
    workflowType: 'FULL' as const,
    shippedAt: new Date('2026-04-25T14:30:21Z'),
  };

  it('marks the row as partial with the given reason', () => {
    const out = buildPartialOutcome(baseInput, 'no_jobs', []);
    expect(out.partial).toBe(true);
    expect(out.partialReason).toBe('no_jobs');
    expect(out.frictionFree).toBe(false);
  });

  it('clears change-shape and semantic tags on partial', () => {
    const out = buildPartialOutcome(baseInput, 'fetch_failed_after_retry', []);
    expect(out.filesTouched).toEqual([]);
    expect(out.linesAdded).toBeNull();
    expect(out.linesRemoved).toBeNull();
    expect(out.testCodeRatio).toBeNull();
    expect(out.domains).toEqual([]);
    expect(out.touchedDbSchema).toBe(false);
    expect(out.touchedTests).toBe(false);
    expect(out.touchedCi).toBe(false);
  });

  it('still aggregates job classification on partial', () => {
    const jobs = [
      {
        id: 1,
        ticketId: 1,
        command: 'iterate',
        status: 'COMPLETED',
        commitSha: null,
        toolsUsed: ['Edit'],
        costUsd: 0.5,
        durationMs: 1000,
        inputTokens: 100,
        outputTokens: 50,
        thinkingTokens: 10,
        cacheReadTokens: 5,
        cacheCreationTokens: 5,
        qualityScore: null,
      } as unknown as Parameters<typeof buildPartialOutcome>[2][0],
    ];
    const out = buildPartialOutcome(baseInput, 'no_commit_reference', jobs);
    expect(out.frictionJobCount).toBe(1);
    expect(out.pipelineJobCount).toBe(0);
    expect(out.totalJobCount).toBe(1);
    expect(out.jobCountByPrefix).toEqual({ iterate: 1 });
    expect(out.totalCostUsd).toBe(0.5);
    expect(out.toolsUsed).toEqual(['Edit']);
  });

  it('returns null totals when every contributing value is null', () => {
    const jobs = [
      {
        id: 1,
        ticketId: 1,
        command: 'specify',
        status: 'COMPLETED',
        commitSha: null,
        toolsUsed: [],
        costUsd: null,
        durationMs: null,
        inputTokens: null,
        outputTokens: null,
        thinkingTokens: null,
        cacheReadTokens: null,
        cacheCreationTokens: null,
        qualityScore: null,
      } as unknown as Parameters<typeof buildPartialOutcome>[2][0],
    ];
    const out = buildPartialOutcome(baseInput, 'no_commit_reference', jobs);
    expect(out.totalCostUsd).toBeNull();
    expect(out.totalDurationMs).toBeNull();
    expect(out.totalInputTokens).toBeNull();
  });
});

describe('readProjectStackConfig', () => {
  it('returns null for null project', () => {
    expect(readProjectStackConfig(null)).toBeNull();
  });

  it('returns null for project with no config', () => {
    const project = { id: 1, config: null } as Parameters<typeof readProjectStackConfig>[0];
    expect(readProjectStackConfig(project)).toBeNull();
  });

  it('extracts language, framework, services, testing.framework', () => {
    const project = {
      id: 1,
      config: {
        project: { language: 'typescript', framework: 'nextjs' },
        services: [{ type: 'postgres' }],
        testing: { framework: 'vitest' },
      },
    } as unknown as Parameters<typeof readProjectStackConfig>[0];
    const cfg = readProjectStackConfig(project);
    expect(cfg).toEqual({
      project: { language: 'typescript', framework: 'nextjs' },
      services: [{ type: 'postgres' }],
      testing: { framework: 'vitest' },
    });
  });

  it('returns null fields when config keys are missing', () => {
    const project = {
      id: 1,
      config: {},
    } as unknown as Parameters<typeof readProjectStackConfig>[0];
    const cfg = readProjectStackConfig(project);
    expect(cfg).toEqual({
      project: { language: null, framework: null },
      services: [],
      testing: { framework: null },
    });
  });
});
