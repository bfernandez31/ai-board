import { describe, it, expect } from 'vitest';
import { estimateAnalysisCostUsd } from '@/lib/analysis/cost-table';

describe('estimateAnalysisCostUsd', () => {
  it('returns the entry for a known (cli, model)', () => {
    const r = estimateAnalysisCostUsd('CLAUDE', 'claude-opus-4-7');
    expect(r.lowerUsd).toBeGreaterThan(0);
    expect(r.upperUsd).toBeGreaterThanOrEqual(r.lowerUsd);
  });

  it('falls back to default model when model is null', () => {
    const r = estimateAnalysisCostUsd('CLAUDE', null);
    expect(r.lowerUsd).toBeGreaterThan(0);
    expect(r.upperUsd).toBeGreaterThanOrEqual(r.lowerUsd);
  });

  it('falls back to a sensible default range for unknown agent+model combo', () => {
    const r = estimateAnalysisCostUsd('CODEX', 'unknown-model-xyz');
    expect(r.lowerUsd).toBeGreaterThan(0);
    expect(r.upperUsd).toBeGreaterThanOrEqual(r.lowerUsd);
  });

  it('preserves lower ≤ upper invariant for every supported agent', () => {
    for (const agent of ['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'] as const) {
      const r = estimateAnalysisCostUsd(agent, null);
      expect(r.lowerUsd).toBeLessThanOrEqual(r.upperUsd);
    }
  });

  it('returns the same value for the default-model and explicit-default', () => {
    const a = estimateAnalysisCostUsd('CLAUDE', null);
    const b = estimateAnalysisCostUsd('CLAUDE', 'claude-sonnet-4-6');
    expect(a).toEqual(b);
  });
});
