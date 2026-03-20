# Tasks: Replace PR Comments with Spec Sync in Code Review

**Input**: Design documents from `/specs/AIB-320-replace-pr-comments/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quality-score-output.md

**Tests**: Included — plan.md explicitly defines test tasks (Task 3) and a Testing Strategy section.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Config Refactor)

**Purpose**: Refactor dimension config in `lib/quality-score.ts` — this is the single source of truth that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Define `DimensionConfig` interface and `DIMENSION_CONFIG` array with 5 dimensions (compliance 0.40, bug-detection 0.30, code-comments 0.20, historical-context 0.10, spec-sync 0.00) in `lib/quality-score.ts`
- [x] T002 Derive `DIMENSION_WEIGHTS` from `DIMENSION_CONFIG` for backward compatibility in `lib/quality-score.ts`
- [x] T003 Add `getDimensionName(agentId)` and `getDimensionWeight(agentId)` helper functions in `lib/quality-score.ts`

**Checkpoint**: `DIMENSION_CONFIG` exported, `DIMENSION_WEIGHTS` derived, helpers available. `computeQualityScore` continues to work with the new config structure.

---

## Phase 2: User Story 1 — Code Review Produces Spec Sync Scores (Priority: P1) 🎯 MVP

**Goal**: Replace the PR Comments agent with a Spec Sync agent in the code review command so that code reviews produce `spec-sync` dimension scores.

**Independent Test**: Run a code review on a PR that modifies spec files and verify the output includes a `spec-sync` dimension score instead of `pr-comments`.

### Implementation for User Story 1

- [x] T004 [US1] Replace Agent #4 (PR Comments) with Spec Sync agent in step 4d of `.claude-plugin/commands/ai-board.code-review.md` — agent checks `specs/specifications/**/*.md` files modified in PR, returns 100 if none modified, otherwise scores spec-code consistency
- [x] T005 [US1] Update step 4a Compliance weight from 0.30 to 0.40 in `.claude-plugin/commands/ai-board.code-review.md`
- [x] T006 [US1] Update step 5 JSON output template: replace `pr-comments` with `spec-sync`, update all dimension weights, update example `qualityScore` computation formula in `.claude-plugin/commands/ai-board.code-review.md`

**Checkpoint**: Code review command has 5 agents with Spec Sync replacing PR Comments; weights match DIMENSION_CONFIG.

---

## Phase 3: User Story 2 — Dimension Config Drives Scoring and Display (Priority: P1)

**Goal**: Verify and test that the single configuration source (DIMENSION_CONFIG) correctly drives both scoring computation and display labels.

**Independent Test**: Verify that adding/removing/reordering a dimension in config reflects in computed score without any other code changes.

### Tests for User Story 2

- [x] T007 [P] [US2] Add unit test: `DIMENSION_CONFIG` has exactly 5 entries in `tests/unit/quality-score.test.ts`
- [x] T008 [P] [US2] Add unit test: active weights (>0) sum to 1.00 in `tests/unit/quality-score.test.ts`
- [x] T009 [P] [US2] Add unit test: `DIMENSION_WEIGHTS` derived map matches config values in `tests/unit/quality-score.test.ts`
- [x] T010 [P] [US2] Add unit test: `getDimensionName` returns correct display names for all 5 dimensions in `tests/unit/quality-score.test.ts`
- [x] T011 [P] [US2] Add unit test: `getDimensionWeight` returns correct weights for all 5 dimensions in `tests/unit/quality-score.test.ts`

**Checkpoint**: Config structure is validated by tests; single source of truth confirmed.

---

## Phase 4: User Story 3 — Updated Weights with Compliance at 0.40 (Priority: P2)

**Goal**: Verify that the rebalanced weights produce correct quality scores — Compliance 0.40, Bug Detection 0.30, Code Comments 0.20, Historical Context 0.10, Spec Sync 0.00.

**Independent Test**: Compute a quality score with known dimension scores and verify the weighted result matches the new weight distribution.

### Tests for User Story 3

- [x] T012 [US3] Update `makeDimensions` helper to use new 5-dimension set (compliance 0.40, bug-detection 0.30, code-comments 0.20, historical-context 0.10, spec-sync 0.00) in `tests/unit/quality-score.test.ts`
- [x] T013 [US3] Update expected weighted sum computations in existing `computeQualityScore` tests to reflect new weights in `tests/unit/quality-score.test.ts`
- [x] T014 [P] [US3] Add unit test: Spec Sync at weight 0.00 does not affect global quality score (score 50 vs score 100 produces identical global score) in `tests/unit/quality-score.test.ts`

**Checkpoint**: All scoring math tests pass with new weight distribution; `bun run test:unit` passes.

---

## Phase 5: User Story 4 — Analytics Display Shows Spec Sync (Priority: P2)

**Goal**: Verify that display components handle both old (`pr-comments`) and new (`spec-sync`) dimension data correctly without code changes.

**Independent Test**: View analytics for a project with both old and new quality score data and verify both display correctly.

### Tests for User Story 4

- [x] T015 [US4] Update test fixture data in `tests/unit/components/quality-score-section.test.tsx` to use new dimension names (Spec Sync) and weights (compliance 0.40, spec-sync 0.00)
- [x] T016 [US4] Verify QualityScoreSection component renders both old `pr-comments` and new `spec-sync` dimension data correctly in `tests/unit/components/quality-score-section.test.tsx`

### Verification for User Story 4 (no code changes expected)

- [x] T017 [US4] Verify `components/ticket/quality-score-section.tsx` renders `dim.name` from stored JSON — old records show "PR Comments", new records show "Spec Sync" (read-only verification, no code changes)
- [x] T018 [US4] Verify `components/analytics/dimension-comparison-chart.tsx` aggregates by `dim.name` from JSON and handles both old and new dimension names (read-only verification, no code changes)
- [x] T019 [US4] Verify `components/ticket/quality-score-badge.tsx` shows only the overall score integer, unaffected by dimension changes (read-only verification, no code changes)

**Checkpoint**: All component tests pass; display components confirmed to handle both old and new data.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories.

- [x] T020 Run `bun run type-check` to verify no TypeScript errors across all modified files
- [x] T021 Run `bun run lint` to verify no linting errors across all modified files
- [x] T022 Run `bun run test:unit` to verify all unit and component tests pass end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 (Phase 2)**: Depends on Phase 1 (needs DIMENSION_CONFIG for weight references)
- **US2 (Phase 3)**: Depends on Phase 1 (tests the config created in Phase 1)
- **US3 (Phase 4)**: Depends on Phase 1 (tests the weights from config)
- **US4 (Phase 5)**: Depends on Phase 1 (verification uses config-driven data)
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 1 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 1 — no dependencies on other stories
- **US3 (P2)**: Can start after Phase 1 — no dependencies on other stories
- **US4 (P2)**: Can start after Phase 1 — no dependencies on other stories
- **US2, US3, US4** all modify `tests/unit/quality-score.test.ts` — execute sequentially within that file (T007-T014 in order)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (where applicable)
- Config before consumers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 → T002 → T003 (sequential — same file, each depends on previous)
- **Phase 2**: T004, T005, T006 can be done together (same file but distinct sections)
- **Phase 3**: T007, T008, T009, T010, T011 can run in parallel (independent test cases)
- **Phase 2 and Phase 3**: Can run in parallel (different files: `.claude-plugin/commands/` vs `tests/unit/`)
- **Phase 5**: T015, T016 (test file) sequential; T017, T018, T019 (verification) in parallel

---

## Parallel Example: Phase 2 + Phase 3

```bash
# These can run simultaneously (different files):
# Agent 1: US1 implementation
Task: T004 "Replace Agent #4 with Spec Sync in .claude-plugin/commands/ai-board.code-review.md"
Task: T005 "Update Compliance weight in .claude-plugin/commands/ai-board.code-review.md"
Task: T006 "Update JSON template in .claude-plugin/commands/ai-board.code-review.md"

# Agent 2: US2 config tests
Task: T007 "Test DIMENSION_CONFIG has 5 entries in tests/unit/quality-score.test.ts"
Task: T008 "Test active weights sum to 1.00 in tests/unit/quality-score.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational config refactor
2. Complete Phase 2: US1 — Spec Sync agent in code review command
3. **STOP and VALIDATE**: Config exists, code review command updated, weights correct
4. This alone delivers the core feature (PR Comments → Spec Sync replacement)

### Incremental Delivery

1. Phase 1 (Foundational) → Config ready
2. Phase 2 (US1) → Code review produces Spec Sync scores (MVP!)
3. Phase 3 (US2) → Config tests validate single source of truth
4. Phase 4 (US3) → Weight math tests confirm rebalancing
5. Phase 5 (US4) → Display compatibility confirmed
6. Phase 6 (Polish) → Full validation pass

### File Change Summary

| File | Phases | Change Type |
|------|--------|-------------|
| `lib/quality-score.ts` | 1 | Modify — add DimensionConfig type, DIMENSION_CONFIG array, helpers, derive DIMENSION_WEIGHTS |
| `.claude-plugin/commands/ai-board.code-review.md` | 2 | Modify — replace Agent #4 PR Comments → Spec Sync, update weights |
| `tests/unit/quality-score.test.ts` | 3, 4 | Modify — add config tests, update makeDimensions, update weight expectations |
| `tests/unit/components/quality-score-section.test.tsx` | 5 | Modify — update fixture data for new dimensions |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No Prisma schema changes — purely application-layer modifications
- No data migration — historical `pr-comments` data preserved in JSON as-is
- Active weights (>0) MUST sum to 1.00
- Total agent count remains 5 (replacement, not addition)
