# Implementation Plan: Replace PR Comments with Spec Sync

**Feature Branch**: `AIB-320-replace-pr-comments`
**Created**: 2026-03-20
**Status**: Ready for Implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| **Affected Layer** | Application logic (TypeScript config, command prompt, tests) |
| **Database Changes** | None — uses existing `qualityScore` / `qualityScoreDetails` fields on Job model |
| **API Changes** | None — same PATCH `/api/jobs/:id/status` contract |
| **Dependencies** | None new |
| **Risk Level** | Low — config change + command prompt update, no schema/API changes |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | New `DimensionConfig` interface with explicit types; no `any` |
| II. Component-Driven | PASS | Display components unchanged; they already read from data |
| III. Test-Driven | PASS | Unit tests updated for new config and weights |
| IV. Security-First | PASS | No new inputs, no API surface changes |
| V. Database Integrity | PASS | No schema changes; existing data preserved |
| VI. AI-First | PASS | No documentation files created at project root |

## Design Artifacts

- [research.md](./research.md) — Research decisions and rationale
- [data-model.md](./data-model.md) — Entity definitions and validation rules
- [contracts/quality-score-output.md](./contracts/quality-score-output.md) — Output format contract
- [quickstart.md](./quickstart.md) — Implementation summary and file list

---

## Implementation Tasks

### Task 1: Refactor Dimension Config in `lib/quality-score.ts` (P1)

**User Stories**: US-2 (config drives scoring and display), US-3 (updated weights)

**Changes**:
1. Define `DimensionConfig` interface:
   ```typescript
   export interface DimensionConfig {
     agentId: string;
     name: string;
     weight: number;
     order: number;
   }
   ```

2. Replace `DIMENSION_WEIGHTS` with `DIMENSION_CONFIG` array:
   ```typescript
   export const DIMENSION_CONFIG: DimensionConfig[] = [
     { agentId: 'compliance', name: 'Compliance', weight: 0.40, order: 1 },
     { agentId: 'bug-detection', name: 'Bug Detection', weight: 0.30, order: 2 },
     { agentId: 'code-comments', name: 'Code Comments', weight: 0.20, order: 3 },
     { agentId: 'historical-context', name: 'Historical Context', weight: 0.10, order: 4 },
     { agentId: 'spec-sync', name: 'Spec Sync', weight: 0.00, order: 5 },
   ];
   ```

3. Derive `DIMENSION_WEIGHTS` from config for backward compatibility:
   ```typescript
   export const DIMENSION_WEIGHTS: Record<string, number> = Object.fromEntries(
     DIMENSION_CONFIG.map(d => [d.agentId, d.weight])
   );
   ```

4. Add helper functions:
   ```typescript
   export function getDimensionName(agentId: string): string;
   export function getDimensionWeight(agentId: string): number;
   ```

**Acceptance**: Config has 5 dimensions, active weights sum to 1.00, `computeQualityScore` produces correct results with new weights.

**Files**: `lib/quality-score.ts`

---

### Task 2: Replace PR Comments Agent with Spec Sync Agent (P1)

**User Stories**: US-1 (code review produces Spec Sync scores)

**Changes** to `.claude-plugin/commands/ai-board.code-review.md`:

1. Replace step 4d (Agent #4 - PR Comments) with:
   ```
   d. Agent #4 (Spec Sync, weight: 0.00): Check if the PR modifies any spec files
      matching `specs/specifications/**/*.md`. If no spec files are modified, return
      dimensionScore 100 immediately. If spec files are modified, read the spec
      changes and code changes, then check for: (a) contradictions between spec
      content and code behavior, (b) gaps where specs document behavior absent
      from code or code adds behavior not in specs. Return a dimensionScore (0-100)
      reflecting spec-code consistency.
   ```

2. Update step 4a weight: `Compliance, weight: 0.40` (was 0.30)

3. Update step 5 JSON template:
   - Replace `pr-comments` with `spec-sync` in the dimensions array
   - Update all weights to match new config
   - Update the example `qualityScore` computation formula

**Acceptance**: Code review command has 5 agents, Spec Sync replaces PR Comments, weights match Task 1 config.

**Files**: `.claude-plugin/commands/ai-board.code-review.md`

---

### Task 3: Update Unit Tests (P1)

**User Stories**: US-2, US-3

**Changes** to `tests/unit/quality-score.test.ts`:

1. Update `makeDimensions` helper to use new dimension set:
   ```typescript
   const makeDimensions = (scores: number[]): DimensionScore[] => [
     { name: 'Compliance', agentId: 'compliance', score: scores[0], weight: 0.40, weightedScore: scores[0] * 0.40 },
     { name: 'Bug Detection', agentId: 'bug-detection', score: scores[1], weight: 0.30, weightedScore: scores[1] * 0.30 },
     { name: 'Code Comments', agentId: 'code-comments', score: scores[2], weight: 0.20, weightedScore: scores[2] * 0.20 },
     { name: 'Historical Context', agentId: 'historical-context', score: scores[3], weight: 0.10, weightedScore: scores[3] * 0.10 },
     { name: 'Spec Sync', agentId: 'spec-sync', score: scores[4], weight: 0.00, weightedScore: 0 },
   ];
   ```

2. Update expected weighted sum computations in existing tests

3. Add new tests:
   - `DIMENSION_CONFIG` has exactly 5 entries
   - Active weights (>0) sum to 1.00
   - `getDimensionName` returns correct display names
   - `getDimensionWeight` returns correct weights
   - Spec Sync at weight 0.00 does not affect global score
   - `DIMENSION_WEIGHTS` derived map matches config

**Changes** to `tests/unit/components/quality-score-section.test.tsx`:
4. Update test fixture data to use new dimension names and weights

**Acceptance**: All unit tests pass with `bun run test:unit`.

**Files**: `tests/unit/quality-score.test.ts`, `tests/unit/components/quality-score-section.test.tsx`

---

### Task 4: Verify Display Components Handle Both Old and New Data (P2)

**User Stories**: US-4 (analytics shows Spec Sync)

**Verification** (no code changes expected):

1. `components/ticket/quality-score-section.tsx` — Already renders `dim.name` from stored JSON. Old records show "PR Comments", new records show "Spec Sync". **No change needed.**

2. `components/analytics/dimension-comparison-chart.tsx` — Already reads dimension names from aggregated data. Analytics query (`lib/analytics/queries.ts:570-590`) aggregates by `dim.name` from JSON. Both old and new dimension names will appear. **No change needed.**

3. `components/ticket/quality-score-badge.tsx` — Shows only the overall score integer. **No change needed.**

**Acceptance**: Manual verification that display components render correctly with both old (`pr-comments`) and new (`spec-sync`) dimension data in `qualityScoreDetails` JSON.

**Files**: None (verification only)

---

## Testing Strategy

| Test Type | Scope | Location | Priority |
|-----------|-------|----------|----------|
| **Unit** | `DIMENSION_CONFIG` structure, weights sum, helper functions | `tests/unit/quality-score.test.ts` | P1 |
| **Unit** | `computeQualityScore` with new weights | `tests/unit/quality-score.test.ts` | P1 |
| **Unit** | Spec Sync weight=0 has no impact on global score | `tests/unit/quality-score.test.ts` | P1 |
| **Component** | QualityScoreSection renders new dimension data | `tests/unit/components/quality-score-section.test.tsx` | P2 |
| **Component** | QualityScoreSection renders old pr-comments data | `tests/unit/components/quality-score-section.test.tsx` | P2 |

**Test type rationale**:
- Pure config validation and scoring math → **Unit tests** (decision tree #1)
- React component rendering → **Component tests** (decision tree #2)
- No API or DB changes → no integration tests needed
- No browser-required features → no E2E tests needed

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Historical analytics show mixed dimension names | Medium | Low | Expected behavior per spec; both names display correctly |
| Spec Sync agent produces low scores on PRs with spec changes | Low | Low | Weight is 0.00 so no impact on global score |
| `DIMENSION_WEIGHTS` consumers break | Low | Medium | Derived from config; same shape as before |

## File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `lib/quality-score.ts` | Modify | Add `DimensionConfig` type, `DIMENSION_CONFIG` array, helper functions; derive `DIMENSION_WEIGHTS` |
| `.claude-plugin/commands/ai-board.code-review.md` | Modify | Replace Agent #4 PR Comments → Spec Sync; update weights |
| `tests/unit/quality-score.test.ts` | Modify | Update test data and add new config/weight tests |
| `tests/unit/components/quality-score-section.test.tsx` | Modify | Update fixture data for new dimensions |
