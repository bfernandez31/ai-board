# Implementation Summary: Replace PR Comments with Spec Sync in Code Review

**Branch**: `AIB-320-replace-pr-comments` | **Date**: 2026-03-20
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced the PR Comments dimension with Spec Sync in code review. Added `DimensionConfig` interface and `DIMENSION_CONFIG` array as single source of truth. Rebalanced weights: Compliance 0.40, Bug Detection 0.30, Code Comments 0.20, Historical Context 0.10, Spec Sync 0.00. Updated code review command to use Spec Sync agent. All unit and component tests updated and passing (35/35).

## Key Decisions

- Used `DIMENSION_CONFIG` array as single source of truth; `DIMENSION_WEIGHTS` derived from it for backward compatibility
- Spec Sync agent weight set to 0.00 so it doesn't affect global quality score while the feature matures
- Display components confirmed to handle both old `pr-comments` and new `spec-sync` data without code changes (they read `dim.name` from stored JSON)

## Files Modified

- `lib/quality-score.ts` — Added DimensionConfig interface, DIMENSION_CONFIG array, getDimensionName/getDimensionWeight helpers, derived DIMENSION_WEIGHTS
- `.claude-plugin/commands/ai-board.code-review.md` — Replaced Agent #4 PR Comments with Spec Sync, updated Compliance weight to 0.40, updated JSON template
- `tests/unit/quality-score.test.ts` — Added 6 new config tests, updated makeDimensions and expected values
- `tests/unit/components/quality-score-section.test.tsx` — Updated fixture data, added backward-compatibility test for old pr-comments data

## ⚠️ Manual Requirements

None
