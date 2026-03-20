# Phase 0 Research: Replace PR Comments with Spec Sync

**Feature**: AIB-321 - Replace PR Comments Dimension with Spec Sync in Code Review
**Date**: 2026-03-20
**Status**: Complete

## Research Summary

This document resolves the design unknowns around review-dimension ownership, verify payload generation, historical compatibility, and changed-spec scoping so Phase 1 can produce implementation artifacts without schema changes.

---

## 1. Shared Dimension Configuration Location

### Decision
Use `lib/quality-score.ts` as the single shared source of truth for review dimension metadata, including agent ID, display name, weight, display order, and whether the dimension contributes to the global weighted score.

### Rationale
- `lib/quality-score.ts` already owns `DimensionScore`, `QualityScoreDetails`, `DIMENSION_WEIGHTS`, `getScoreThreshold()`, and `computeQualityScore()`.
- Ticket review UI in `components/ticket/quality-score-section.tsx` and analytics aggregation in `lib/analytics/queries.ts` already depend on the stored quality-score payload or shared helpers.
- Moving metadata to a typed config in this module keeps computation and display synchronized without introducing a second config file or database table.
- The verify workflow in `.github/workflows/verify.yml` only parses JSON and forwards it to `PATCH /api/jobs/[id]/status`, so changing the payload contents does not require workflow-contract changes.

### Alternatives Considered
- **Keep hardcoded weights in the review command and only update display strings elsewhere**: Rejected because FR-013 requires one shared configuration for scoring and display.
- **Store dimension metadata in Prisma or project settings**: Rejected because the feature only needs static application-level configuration and must not add a migration.
- **Add a new dedicated config module separate from `lib/quality-score.ts`**: Rejected because the current quality-score utilities already own the relevant types and score logic.

---

## 2. Producer-Side Source of the Dimension Payload

### Decision
Update `.claude-plugin/commands/ai-board.code-review.md` to replace the `PR Comments` review agent and output JSON with `Spec Sync`, while leaving `.github/workflows/verify.yml` unchanged because it already accepts arbitrary `QUALITY_SCORE_JSON` payloads.

### Rationale
- The command currently defines all five review agents and hardcodes the emitted JSON example, including:
  - `PR Comments` agent at weight `0.10`
  - `qualityScore = round(sum(dimension.score * dimension.weight))`
  - A fixed five-dimension JSON payload with `weightedScore`
- The workflow only searches stdout for `QUALITY_SCORE_JSON:`, extracts `.qualityScore`, and persists the full JSON string untouched.
- The API endpoint `PATCH /api/jobs/[id]/status` and `jobStatusUpdateSchema` only require `qualityScoreDetails` to be a string, so the stored payload can evolve without route changes.

### Alternatives Considered
- **Change the verify workflow to transform the payload**: Rejected because it adds unnecessary duplication and splits dimension logic across two systems.
- **Transform `PR Comments` to `Spec Sync` after persistence in the app**: Rejected because it would keep the review producer out of sync with displayed data and violate FR-013.
- **Add a migration to normalize old records**: Rejected because the spec explicitly allows historical records to remain as-is.

---

## 3. Historical Review Compatibility

### Decision
Preserve historical `PR Comments` data in stored `qualityScoreDetails` and make consumers tolerant of both legacy and new dimension names, while only new reviews emit `Spec Sync`.

### Rationale
- `Job.qualityScoreDetails` is an untyped JSON string column in `prisma/schema.prisma`, so legacy review records remain queryable without schema conversion.
- Analytics aggregation in `lib/analytics/queries.ts` groups dimensions by `dim.name` from stored JSON; ticket review UI in `components/ticket/quality-score-section.tsx` renders the dimensions provided by the latest scored verify job.
- This means historical records can remain interpretable if the UI and analytics do not assume only one possible fifth-dimension label.
- It also means analytics will temporarily show separate `PR Comments` and `Spec Sync` categories across mixed historical/new data unless a later migration or normalization layer is added.
- The feature spec only requires new reviews to display `Spec Sync` where `PR Comments` previously appeared; it does not require backfilling or rewriting old records.

### Alternatives Considered
- **Rewrite historical JSON strings in place**: Rejected because it adds data migration risk with no functional requirement.
- **Hide historical `PR Comments` everywhere after rollout**: Rejected because it makes older reviews less interpretable.
- **Show only dimensions present in the current shared config and discard unknown historical ones**: Rejected because it could silently drop legacy data from analytics.

---

## 4. Scope Rule for Spec Sync Evaluation

### Decision
Define Spec Sync to inspect only files under `specs/specifications/` that are changed in the current pull request, and return a score of `100` with no findings when no such files are modified.

### Rationale
- The feature spec’s assumptions explicitly limit scope to `specs/specifications/`.
- The auto-resolved decisions require no-spec pull requests to be treated as a successful no-op review.
- Limiting the review agent’s input set to changed spec files reduces false positives from unrelated legacy specifications and matches FR-002 and FR-005.
- This scope can be implemented entirely in the review command prompt by instructing the `Spec Sync` agent to reason over the PR diff’s changed specification files, without application schema changes.

### Alternatives Considered
- **Inspect every spec in the repository on every PR**: Rejected because it expands scope beyond the ticket and increases false positives.
- **Inspect any changed file under `specs/`**: Rejected because the spec narrows scope to `specs/specifications/`.
- **Fail or skip the dimension when no spec files change**: Rejected because FR-005 requires a score of `100` and no issues.

---

## 5. Zero-Weight Visibility and Score Computation

### Decision
Keep `Spec Sync` in persisted dimension arrays, ticket breakdowns, and analytics, but exclude it from the overall `qualityScore` and threshold classification while its configured weight is `0.00`.

### Rationale
- The feature spec explicitly requires visibility without affecting the active gate for this release.
- `computeQualityScore()` in `lib/quality-score.ts` can satisfy this by summing only active weighted dimensions and still storing `weightedScore: 0` for `Spec Sync`.
- Analytics `dimensionComparison` already reports each dimension’s average score and weight independently, so zero-weight visibility fits the current response shape.
- This keeps score continuity intact while beginning to collect live data for the new dimension.

### Alternatives Considered
- **Remove Spec Sync from persisted payloads until activated**: Rejected because FR-008 requires storing the dimension and its issues now.
- **Include zero-weight dimensions in threshold classification anyway**: Rejected because FR-009 forbids it.
- **Hide zero-weight dimensions from ticket and analytics UI**: Rejected because the spec requires visibility anywhere dimension scores are shown.

---

## Final Outcome

All Technical Context unknowns are resolved. No schema migration is required. The implementation should center on a shared dimension config in `lib/quality-score.ts`, a producer update in `.claude-plugin/commands/ai-board.code-review.md`, and consumer/test updates that preserve compatibility with historical `PR Comments` records.
