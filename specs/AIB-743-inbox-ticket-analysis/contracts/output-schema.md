# Contract: `AnalysisOutputSchema` (Zod)

**Branch**: `AIB-743-inbox-ticket-analysis` · **Date**: 2026-04-27

The single source of truth for the panel's structured payload. Validated server-side by the workflow PATCH endpoint (§3 in `analysis-api.md`) and consumed by the panel renderer as typed props. The schema is intentionally narrow so model output that doesn't conform → row marked `failed` with `errorReason='invalid_model_output'` (D7 in research.md).

This contract is implemented in `lib/analysis/output-schema.ts`.

---

## Top-level shape (success)

```ts
type AnalysisOutput = {
  frictionRisk: 'low' | 'medium' | 'high';
  qualityGateRange: { lower: number; upper: number };          // 0..100, lower ≤ upper
  recommendation: {
    choice: 'QUICK' | 'FULL';
    confidence: 'low' | 'medium' | 'high';
    justification: string;                                      // 1..1000 chars
  };
  costRange: {
    baselineLowerUsd: number;
    baselineUpperUsd: number;                                   // ≥ baselineLower
    marginalFrictionLowerUsd: number;
    marginalFrictionUpperUsd: number;                           // ≥ marginalFrictionLower
  };
  scopeWarnings: ScopeWarning[];                                // 0..5
  anchors: AnchorCitation[];                                    // 0..5
};

type ScopeWarning = {
  category:
    | 'ambiguity_core_requirement'
    | 'multi_feature_bundling'
    | 'missing_acceptance_criteria'
    | 'missing_scope_boundary'
    | 'other';
  message: string;                                              // 1..280 chars, single sentence
};

type AnchorCitation = {
  ticketId: number;                                             // FK to Ticket.id
  ticketKey: string;                                            // /^[A-Z]{2,6}-\d+$/
  frictionFree: boolean;                                        // snapshot from anchor's TicketOutcome
  qualityScore: number | null;                                  // 0..100 or null = "no score"
  overlapStrength: number;                                      // ≥ 1 (count of shared structural domains)
};
```

## Top-level shape (cold_start)

```ts
type ColdStartOutput = {
  scopeWarnings: ScopeWarning[];                                // 0..5
};
```

The cold-start output deliberately omits `frictionRisk`, ranges, recommendation, and anchors. The panel renderer reads `status === 'cold_start'` → renders the cold-start notice + scope warnings only (FR-014, User Story 2).

---

## Validation refinements (server-side, beyond shape)

| Refinement | Implementation |
|---|---|
| `qualityGateRange.lower ≤ qualityGateRange.upper` | `.refine` on `QualityGateRangeSchema` |
| `costRange.baselineLowerUsd ≤ baselineUpperUsd` | `.refine` on `CostRangeSchema` |
| `costRange.marginalFrictionLowerUsd ≤ marginalFrictionUpperUsd` | same |
| `anchors[*].ticketId ⊆ row.anchorIdsAttempted` | enforced in PATCH handler (custom refinement that needs DB row context — applied after schema parse) |
| Unknown JSON keys → strict reject | Zod `.strict()` on every object schema |

---

## Mapping to spec requirements

| Spec requirement | Schema element |
|---|---|
| FR-017: friction-risk in {low, medium, high} | `FrictionRiskEnum` |
| FR-017: quality-gate range with lower + upper | `QualityGateRangeSchema` |
| FR-017: recommendation in {QUICK, FULL} + confidence + justification | `recommendation.{choice, confidence, justification}` |
| FR-017: cost range decomposed into baseline + marginal | `CostRangeSchema` |
| FR-017: ≤ 5 scope warnings | `.max(5)` on `scopeWarnings` |
| FR-017: ≤ 5 anchors ordered by overlap strength | `.max(5)` on `anchors`; ordering is the model's responsibility (rendered as-given) |
| FR-018: each anchor displays key + friction status + quality score | `AnchorCitationSchema` carries all three |
| FR-018: each anchor links to the past ticket | The panel constructs the link from `(projectId, ticketKey)` — IDs are sufficient |
| Edge case: anchor source ticket deleted | Marked `tombstoned: true` at serialisation (not a schema field — added in API response only, see `analysis-api.md` §1) |

---

## Why this lives in `lib/analysis/output-schema.ts` (not a generated file)

- The shape is small, stable, and human-edited.
- Both the API route handler and the React panel component import the same schema → identical type narrowing on both sides (Constitution I: "All API responses ... have corresponding TypeScript interfaces").
- No code generation is needed; `z.infer<typeof AnalysisOutputSchema>` is the canonical TS type.

## Versioning

The schema version is implicit in `ANALYSIS_RULE_SET_VERSION` (data-model §1). When the schema changes in a backward-incompatible way (e.g. adding a required field), bump the constant. The panel reads `row.ruleSetVersion` and can render legacy rows under their original schema if multiple versions ever coexist (not expected pre-MVP — listed for completeness).
