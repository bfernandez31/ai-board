# Quickstart: Replace PR Comments with Spec Sync

## Files to Modify

### Core Config & Scoring
1. **`lib/quality-score.ts`** — Replace `DIMENSION_WEIGHTS` with `DIMENSION_CONFIG` array; export helper functions; update `computeQualityScore` to use config

### Code Review Command
2. **`.claude-plugin/commands/ai-board.code-review.md`** — Replace Agent #4 (PR Comments) with Spec Sync agent; update weights in all agent descriptions; update JSON output template

### Display Components (config-driven labels)
3. **`components/ticket/quality-score-section.tsx`** — Already reads `dim.name` from JSON (no change needed for historical data)
4. **`components/analytics/dimension-comparison-chart.tsx`** — Already reads from data (no change needed)

### Tests
5. **`tests/unit/quality-score.test.ts`** — Update `makeDimensions` helper with new weights and spec-sync dimension; add tests for new config exports
6. **`tests/unit/components/quality-score-section.test.tsx`** — Update test data with new dimension names/weights

## Implementation Order

1. `lib/quality-score.ts` (config + scoring) — foundational
2. `.claude-plugin/commands/ai-board.code-review.md` (agent replacement) — core feature
3. Update tests — verify correctness
4. Verify display components work with new data — no code changes expected

## Key Constraints
- NO Prisma schema changes
- NO data migration
- Active weights (>0) MUST sum to 1.00
- Total agent count remains 5
- Historical `pr-comments` data continues displaying correctly
