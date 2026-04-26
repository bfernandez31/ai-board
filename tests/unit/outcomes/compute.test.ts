import { describe, it, expect } from 'vitest';
import { buildOutcome } from '@/lib/outcomes/compute';
import { FRICTION_FREE_QUALITY_THRESHOLD } from '@/lib/outcomes/types';

const tsConfig = {
  project: { language: 'typescript', framework: 'nextjs' },
  services: [{ type: 'postgres' }],
  testing: { framework: 'vitest', e2e: true, e2e_framework: 'playwright' },
};

describe('buildOutcome', () => {
  it('produces a partial record (hasCommitData=false) when diff is null', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 1.23,
        totalDurationMs: 4567,
        pipelineJobCount: 3,
        frictionJobCount: 0,
        finalQualityScore: 90,
      },
      diff: null,
      projectConfig: tsConfig,
    });

    expect(outcome.hasCommitData).toBe(false);
    expect(outcome.filesTouched).toBeNull();
    expect(outcome.linesAdded).toBeNull();
    expect(outcome.linesRemoved).toBeNull();
    expect(outcome.codeFilesChanged).toBeNull();
    expect(outcome.testFilesChanged).toBeNull();
    expect(outcome.structuralDomains).toEqual([]);
    expect(outcome.semanticTags).toEqual([]);
    // Job signals still present
    expect(outcome.totalCostUsd).toBe(1.23);
    expect(outcome.pipelineJobCount).toBe(3);
    expect(outcome.finalQualityScore).toBe(90);
  });

  it('populates change shape and domains when diff is provided', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 0.5,
        totalDurationMs: 1000,
        pipelineJobCount: 4,
        frictionJobCount: 0,
        finalQualityScore: 95,
      },
      diff: {
        files: [
          { path: 'lib/foo.ts', additions: 10, deletions: 2 },
          { path: 'tests/unit/foo.test.ts', additions: 5, deletions: 0 },
          { path: 'prisma/schema.prisma', additions: 3, deletions: 0 },
        ],
        totalAdditions: 18,
        totalDeletions: 2,
      },
      projectConfig: tsConfig,
    });

    expect(outcome.hasCommitData).toBe(true);
    expect(outcome.filesTouched).toBe(3);
    expect(outcome.linesAdded).toBe(18);
    expect(outcome.linesRemoved).toBe(2);
    expect(outcome.structuralDomains).toEqual(['lib', 'prisma', 'tests']);
    expect(outcome.semanticTags).toContain('touched_db_schema');
    expect(outcome.semanticTags).toContain('touched_tests');
    expect(outcome.codeFilesChanged).toBe(2); // lib/foo.ts + prisma/schema.prisma
    expect(outcome.testFilesChanged).toBe(1);
  });

  it('marks frictionFree=true when no friction jobs and quality above threshold', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 0.5,
        totalDurationMs: 1000,
        pipelineJobCount: 4,
        frictionJobCount: 0,
        finalQualityScore: FRICTION_FREE_QUALITY_THRESHOLD + 1,
      },
      diff: null,
      projectConfig: tsConfig,
    });
    expect(outcome.frictionFree).toBe(true);
  });

  it('marks frictionFree=false when ANY friction jobs ran (even with high quality)', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 0.5,
        totalDurationMs: 1000,
        pipelineJobCount: 4,
        frictionJobCount: 1,
        finalQualityScore: 99,
      },
      diff: null,
      projectConfig: tsConfig,
    });
    expect(outcome.frictionFree).toBe(false);
  });

  it('marks frictionFree=false when quality is below threshold (no friction jobs)', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 0.5,
        totalDurationMs: 1000,
        pipelineJobCount: 4,
        frictionJobCount: 0,
        finalQualityScore: FRICTION_FREE_QUALITY_THRESHOLD - 1,
      },
      diff: null,
      projectConfig: tsConfig,
    });
    expect(outcome.frictionFree).toBe(false);
  });

  it('marks frictionFree=true when quality score is missing and no friction jobs (quick-impl path)', () => {
    const outcome = buildOutcome({
      jobSignals: {
        totalCostUsd: 0.5,
        totalDurationMs: 1000,
        pipelineJobCount: 1,
        frictionJobCount: 0,
        finalQualityScore: null,
      },
      diff: null,
      projectConfig: tsConfig,
    });
    expect(outcome.frictionFree).toBe(true);
  });
});
