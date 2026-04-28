import { describe, it, expect } from 'vitest';
import {
  AnalysisOutputSchema,
  ColdStartOutputSchema,
  QualityGateRangeSchema,
  CostRangeSchema,
  ScopeWarningSchema,
  AnchorCitationSchema,
  type AnalysisOutput,
  type ColdStartOutput,
} from '@/lib/analysis/output-schema';

const validAnchor = {
  ticketId: 100,
  ticketKey: 'AIB-100',
  frictionFree: true,
  qualityScore: 88,
  overlapStrength: 2,
};

function validSuccess(): AnalysisOutput {
  return {
    frictionRisk: 'medium',
    qualityGateRange: { lower: 70, upper: 85 },
    recommendation: {
      choice: 'FULL',
      confidence: 'medium',
      justification: 'Anchor #1 indicates friction in tests; FULL gives more headroom.',
    },
    costRange: {
      baselineLowerUsd: 0.1,
      baselineUpperUsd: 0.2,
      marginalFrictionLowerUsd: 0,
      marginalFrictionUpperUsd: 0.05,
    },
    scopeWarnings: [
      { category: 'ambiguity_core_requirement', message: 'Core requirement is unclear.' },
    ],
    anchors: [validAnchor],
  };
}

describe('AnalysisOutputSchema (success shape)', () => {
  it('accepts a fully populated success payload', () => {
    expect(() => AnalysisOutputSchema.parse(validSuccess())).not.toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      AnalysisOutputSchema.parse({ ...validSuccess(), extra: true })
    ).toThrow();
  });

  it('rejects qualityGateRange.lower > upper', () => {
    const bad = validSuccess();
    bad.qualityGateRange = { lower: 90, upper: 50 };
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects costRange when baselineLower > baselineUpper', () => {
    const bad = validSuccess();
    bad.costRange.baselineLowerUsd = 0.5;
    bad.costRange.baselineUpperUsd = 0.1;
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects more than 5 scopeWarnings', () => {
    const bad = validSuccess();
    bad.scopeWarnings = Array.from({ length: 6 }, () => ({
      category: 'other',
      message: 'msg',
    }));
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects more than 5 anchors', () => {
    const bad = validSuccess();
    bad.anchors = Array.from({ length: 6 }, (_, i) => ({
      ...validAnchor,
      ticketId: i + 1,
      ticketKey: `AIB-${i + 1}`,
    }));
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects invalid frictionRisk enum', () => {
    const bad = validSuccess() as unknown as Record<string, unknown>;
    bad.frictionRisk = 'critical';
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects invalid recommendation.choice enum', () => {
    const bad = validSuccess();
    (bad.recommendation as { choice: string }).choice = 'OTHER';
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects invalid recommendation.confidence enum', () => {
    const bad = validSuccess();
    (bad.recommendation as { confidence: string }).confidence = 'unknown';
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('rejects invalid scopeWarnings[].category enum', () => {
    const bad = validSuccess();
    (bad.scopeWarnings[0] as { category: string }).category = 'unknown_category';
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });

  it('accepts qualityScore=null on anchor', () => {
    const ok = validSuccess();
    ok.anchors[0].qualityScore = null;
    expect(() => AnalysisOutputSchema.parse(ok)).not.toThrow();
  });

  it('rejects ticketKey not matching pattern', () => {
    const bad = validSuccess();
    bad.anchors[0].ticketKey = 'lowercase-1';
    expect(() => AnalysisOutputSchema.parse(bad)).toThrow();
  });
});

describe('ColdStartOutputSchema', () => {
  it('accepts an empty cold-start payload', () => {
    const ok: ColdStartOutput = { scopeWarnings: [] };
    expect(() => ColdStartOutputSchema.parse(ok)).not.toThrow();
  });

  it('accepts cold-start with scope warnings', () => {
    const ok: ColdStartOutput = {
      scopeWarnings: [{ category: 'other', message: 'thin description' }],
    };
    expect(() => ColdStartOutputSchema.parse(ok)).not.toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      ColdStartOutputSchema.parse({ scopeWarnings: [], extra: 'x' })
    ).toThrow();
  });
});

describe('Sub-schemas', () => {
  it('QualityGateRangeSchema rejects out-of-range', () => {
    expect(() =>
      QualityGateRangeSchema.parse({ lower: -1, upper: 50 })
    ).toThrow();
  });

  it('CostRangeSchema rejects negative values', () => {
    expect(() =>
      CostRangeSchema.parse({
        baselineLowerUsd: -0.01,
        baselineUpperUsd: 0.05,
        marginalFrictionLowerUsd: 0,
        marginalFrictionUpperUsd: 0.01,
      })
    ).toThrow();
  });

  it('ScopeWarningSchema rejects message > 280 chars', () => {
    expect(() =>
      ScopeWarningSchema.parse({ category: 'other', message: 'x'.repeat(281) })
    ).toThrow();
  });

  it('AnchorCitationSchema rejects overlapStrength < 1', () => {
    expect(() =>
      AnchorCitationSchema.parse({ ...validAnchor, overlapStrength: 0 })
    ).toThrow();
  });
});

// T018 — cover persist + serialize concerns inline (without DB)
import { isStale } from '@/lib/analysis/stale-check';

describe('serialize-domain concerns (no DB)', () => {
  it('isStale returns false on whitespace-only diff', () => {
    expect(
      isStale(
        { title: 'A B', description: 'one\ntwo' },
        { titleSnapshot: 'A   B', descriptionSnapshot: 'one two' }
      )
    ).toBe(false);
  });

  it('isStale returns true on word-level diff', () => {
    expect(
      isStale(
        { title: 'A B', description: 'one two three' },
        { titleSnapshot: 'A B', descriptionSnapshot: 'one two' }
      )
    ).toBe(true);
  });
});
