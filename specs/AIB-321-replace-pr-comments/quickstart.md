# Quickstart: Replace PR Comments with Spec Sync

**Feature**: AIB-321-replace-pr-comments
**Date**: 2026-03-20

## Overview

Implement the review-dimension replacement by updating the shared quality-score configuration first, then changing the code-review producer, and finally aligning ticket/analytics consumers and tests. The feature is complete when new verify jobs emit and display `Spec Sync`, zero-weight scoring leaves thresholds unchanged, and historical `PR Comments` records still render correctly.

## Prerequisites

- [ ] Read `spec.md`
- [ ] Read `plan.md`
- [ ] Read `research.md`
- [ ] Read `data-model.md`
- [ ] Review `contracts/quality-score-dimensions.yaml`

## Implementation Order

### Step 1: Extend Existing Tests First

Search existing coverage before editing implementation files:

```bash
rg -n "PR Comments|Spec Sync|qualityScore|computeQualityScore" tests/unit tests/integration
```

Update these files first:
- `tests/unit/quality-score.test.ts`
- `tests/unit/components/quality-score-section.test.tsx`
- `tests/integration/analytics/quality-score.test.ts`
- `tests/integration/jobs/status.test.ts`

Target assertions:
- Shared config contains `spec-sync` and no longer configures `pr-comments` for new reviews.
- Overall score ignores zero-weight `Spec Sync`.
- Ticket quality-score details render `Spec Sync` for new review payloads.
- Analytics include `Spec Sync` for new review data while legacy `PR Comments` payloads remain parseable.
- Job status persistence accepts completed payloads containing a zero-weight `Spec Sync` dimension.

### Step 2: Centralize Dimension Metadata

Primary file:
- `lib/quality-score.ts`

Planned changes:
- Replace `DIMENSION_WEIGHTS` with a richer shared config for name, agentId, weight, and score participation.
- Keep `DimensionScore` and `QualityScoreDetails` compatible with persisted JSON.
- Make `computeQualityScore()` sum only dimensions that affect the overall score.
- Export helpers consumers can reuse for consistent display ordering if needed.

### Step 3: Update the Producer

Primary file:
- `.claude-plugin/commands/ai-board.code-review.md`

Planned changes:
- Replace the `PR Comments` review agent instructions with `Spec Sync`.
- Restrict the agent’s scope to changed files under `specs/specifications/`.
- Define no-spec PR behavior as score `100` with no issues.
- Update the example `QUALITY_SCORE_JSON` payload to emit:
  - `Compliance` weight `0.40`
  - `Spec Sync` weight `0.00`
  - No `PR Comments` row for newly generated reviews

### Step 4: Align Consumers

Primary files:
- `components/ticket/quality-score-section.tsx`
- `lib/analytics/queries.ts`
- `components/analytics/dimension-comparison-chart.tsx` if ordering or labels need config-driven alignment

Planned changes:
- Ensure new review details show `Spec Sync` in the fifth dimension slot.
- Preserve compatibility for stored legacy payloads that still contain `PR Comments`.
- Keep analytics grouping and ordering stable when `Spec Sync` has `weight = 0`.
- Accept that mixed historical/new datasets will surface separate `PR Comments` and `Spec Sync` labels unless an explicit normalization rule is added later.

### Step 5: Validate Persistence Path

Primary files:
- `.github/workflows/verify.yml`
- `app/api/jobs/[id]/status/route.ts`
- `app/lib/job-update-validator.ts`

Validation goals:
- Confirm no workflow or API changes are required beyond updated payload contents.
- Confirm the completed-job persistence path remains backward compatible.

## Testing Strategy

### User Story 1

Use unit plus integration tests.
- Unit: score payload/config helpers for Spec Sync and no-spec success behavior.
- Integration: verify persisted job details and analytics payloads for reviews with changed specs.

### User Story 2

Use unit plus integration tests.
- Unit: overall score and threshold computation exclude zero-weight dimensions.
- Integration: stored `qualityScore` and analytics averages remain stable for active dimensions.

### User Story 3

Use component plus integration tests.
- Component: `QualityScoreSection` renders `Spec Sync` in detail breakdowns for new payloads.
- Integration: analytics dimension comparison exposes `Spec Sync` and does not require separate UI config.

### Why No E2E

This feature does not require browser-only behavior. The risk is in score configuration, stored JSON, and analytics aggregation, so Vitest coverage is the correct layer.

## Verification Commands

```bash
bun run test:unit -- quality-score
bun run test:unit -- quality-score-section
bun run test:integration -- analytics/quality-score.test.ts
bun run test:integration -- jobs/status.test.ts
bun run type-check
bun run lint
```

## Expected Outcome

- New reviews emit `Spec Sync` instead of `PR Comments`.
- `Compliance` contributes `0.40` to the weighted score.
- `Spec Sync` is stored and displayed but does not affect `qualityScore` or threshold classification.
- Historical review records remain interpretable without migration.
