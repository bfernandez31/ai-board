# Quick Implementation: Replace PR Comments dimension with Spec Sync in code review

**Feature Branch**: `AIB-322-copy-of-replace`
**Created**: 2026-03-20
**Mode**: Quick Implementation

## Description

Replace the PR Comments dimension (weight 0.10) with a new Spec Sync dimension that checks consistency between specs modified in the PR and code changes in the same PR. Rebalance weights to increase Compliance from 0.30 to 0.40. Spec Sync starts at weight 0.00 (computed but excluded from global score).

## Changes Made

### `lib/quality-score.ts`
- Added `DimensionConfig` interface and `DIMENSIONS` array as single source of truth
- Replaced `pr-comments` (0.10) with `spec-sync` (0.00)
- Increased `compliance` weight from 0.30 to 0.40
- Derived `DIMENSION_WEIGHTS` from `DIMENSIONS` for backward compatibility

### `.claude-plugin/commands/ai-board.code-review.md`
- Replaced Agent #4 (PR Comments) with Spec Sync agent
- Updated JSON output schema with new dimension names and weights
- Spec Sync checks `specs/specifications/**/*.md` files modified in PR for consistency with code changes
- If no spec files modified → score 100

### Tests Updated
- `tests/unit/quality-score.test.ts` — new `DIMENSIONS config` suite, updated `computeQualityScore` for new weights
- `tests/unit/components/quality-score-section.test.tsx` — updated mock data
- `tests/integration/analytics/quality-score.test.ts` — updated fixture data

## Dimension Weights

| Dimension | Weight |
|-----------|--------|
| Compliance | 0.40 |
| Bug Detection | 0.30 |
| Code Comments | 0.20 |
| Historical Context | 0.10 |
| Spec Sync | 0.00 |

Active weights sum to 1.00. Agent count remains 5.
