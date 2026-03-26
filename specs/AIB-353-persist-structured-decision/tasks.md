# Tasks: Persist Structured Decision Points in Comparison Data

**Input**: Design documents from `/specs/AIB-353-persist-structured-decision/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per plan.md testing strategy (unit + integration).

**Organization**: Tasks grouped by user story. US2 (data pipeline) precedes US1 (UI display) since US1 depends on US2's output.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this feature extends an existing codebase with no schema migrations and no new dependencies.

*(No tasks — existing project structure is sufficient)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions that multiple user stories depend on

**CRITICAL**: Must complete before any user story work begins

- [x] T001 Add `ReportDecisionPointApproach` and `ReportDecisionPoint` interfaces and optional `decisionPoints` field to `ComparisonReport` in `lib/types/comparison.ts`

**Checkpoint**: Foundation ready — type definitions available for validation and persistence tasks

---

## Phase 3: User Story 2 — Structured Decision Point Data in JSON Payload (Priority: P1) MVP

**Goal**: AI comparison generates a JSON payload with per-decision-point structured data that is validated and persisted accurately to the database.

**Independent Test**: Generate a comparison JSON payload with a `decisionPoints` array and verify each entry is persisted as a distinct `DecisionPointEvaluation` record with its own verdict, rationale, and approaches.

### Tests for User Story 2

- [ ] T002 [P] [US2] Unit test: Zod schema validates payloads with `decisionPoints` (valid, missing fields, null verdict, empty approaches, defaults to `[]` when absent) in `tests/unit/comparison-payload.test.ts`
- [ ] T003 [P] [US2] Unit test: `buildDecisionPoints()` structured path maps `ReportDecisionPoint[]` to Prisma input with correct `verdictTicketId` resolution, approach filtering, and `displayOrder` in `tests/unit/comparison-record.test.ts`

### Implementation for User Story 2

- [x] T004 [US2] Add `reportDecisionPointApproachSchema` and `reportDecisionPointSchema` Zod schemas, and add optional `decisionPoints` field (`.optional().default([])`) to `serializedComparisonReportSchema` in `lib/comparison/comparison-payload.ts`
- [x] T005 [US2] Update `buildDecisionPoints()` to use structured `report.decisionPoints` when present and non-empty: map each entry to Prisma input resolving `verdictTicketKey` to `verdictTicketId` via `ticketKeyToId`, filter invalid approach `ticketKey` references, and set `displayOrder` from array index in `lib/comparison/comparison-record.ts`

**Checkpoint**: Structured decision points are validated and persisted — verify unit tests pass

---

## Phase 4: User Story 3 — Backward Compatibility for Existing Comparisons (Priority: P2)

**Goal**: Existing comparisons without the `decisionPoints` field continue to display using the current fallback behavior (deriving from `matchingRequirements` with global winner).

**Independent Test**: Load or create a comparison record without `decisionPoints` in the report JSON and verify the UI renders without errors using fallback-derived content.

### Tests for User Story 3

- [ ] T006 [P] [US3] Unit test: `buildDecisionPoints()` fallback path is triggered when `decisionPoints` is absent or empty, producing decision points from `matchingRequirements` with global winner in `tests/unit/comparison-record.test.ts`
- [ ] T007 [P] [US3] Unit test: Zod schema accepts payloads without `decisionPoints` field and defaults to empty array in `tests/unit/comparison-payload.test.ts`

### Implementation for User Story 3

- [ ] T008 [US3] Verify fallback path in `buildDecisionPoints()` preserves existing `matchingRequirements`-based derivation logic unchanged when `report.decisionPoints` is absent or empty in `lib/comparison/comparison-record.ts`

**Checkpoint**: Backward compatibility confirmed — both old and new payload formats handled correctly

---

## Phase 5: User Story 4 — Compare Command Template Guides AI Output (Priority: P2)

**Goal**: The comparison command template instructs the AI to include structured `decisionPoints` in the JSON output, ensuring the AI produces the data needed for persistence.

**Independent Test**: Review the command template for the `decisionPoints` field specification and verify the schema matches the Zod validation.

### Implementation for User Story 4

- [ ] T009 [US4] Add `decisionPoints` array schema specification to Step 10.5 JSON payload in `.claude-plugin/commands/ai-board.compare.md` with fields: `title`, `verdictTicketKey`, `verdictSummary`, `rationale`, and `approaches[]` (`ticketKey`, `summary`)
- [ ] T010 [US4] Add instruction in Step 10.5 directing AI to populate `decisionPoints` from Step 7 analysis with unique titles matching markdown report and per-point `verdictTicketKey` in `.claude-plugin/commands/ai-board.compare.md`

**Checkpoint**: Command template updated — AI will produce structured decision points in future comparisons

---

## Phase 6: User Story 1 — View Distinct Decision Points in Comparison Dialog (Priority: P1)

**Goal**: Each decision point in the comparison dialog displays its own unique title, rationale, verdict winner, and per-ticket approach descriptions.

**Independent Test**: Create a comparison with structured data and verify each accordion item displays different content.

**Note**: No UI code changes needed — `components/comparison/comparison-decision-points.tsx` already renders per-point data. This phase validates end-to-end correctness.

### Tests for User Story 1

- [ ] T011 [US1] Integration test: Full persistence flow — submit a comparison payload with structured `decisionPoints` via API, verify each `DecisionPointEvaluation` record has distinct per-point `verdictTicketId`, `verdictSummary`, `rationale`, and `participantApproaches` in `tests/integration/comparison/`
- [ ] T012 [US1] Integration test: Backward compatibility — submit a comparison payload without `decisionPoints` via API, verify `DecisionPointEvaluation` records are created using fallback `matchingRequirements` derivation in `tests/integration/comparison/`

**Checkpoint**: End-to-end flow validated — structured decision points persist and display correctly

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling and final validation

- [ ] T013 [P] Edge case: Verify `null` verdict handling — decision point with `verdictTicketKey: null` persists with `verdictTicketId: null` and displays gracefully in unit tests
- [ ] T014 [P] Edge case: Verify empty `decisionPoints` array triggers fallback path (not treated as structured data) in unit tests
- [ ] T015 [P] Edge case: Verify invalid `ticketKey` in approaches is skipped (not failed) when referenced key is not in `participantTicketKeys` in unit tests
- [ ] T016 Run `bun run type-check` and `bun run lint` to validate all changes pass static analysis

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks needed
- **Foundational (Phase 2)**: No dependencies — start immediately
- **US2 (Phase 3)**: Depends on Phase 2 (type definitions)
- **US3 (Phase 4)**: Depends on Phase 3 (same files modified in US2)
- **US4 (Phase 5)**: Independent — can run in parallel with Phases 3-4 (different file)
- **US1 (Phase 6)**: Depends on Phases 3-4 (integration tests need persistence logic)
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **US2 (P1)**: Depends on Foundational — core data pipeline, no other story dependencies
- **US3 (P2)**: Depends on US2 — fallback is built into the same `buildDecisionPoints()` function
- **US4 (P2)**: Independent — command template touches a different file entirely
- **US1 (P1)**: Depends on US2 + US3 — integration tests validate the full flow

### Within Each User Story

- Tests written first (TDD where applicable)
- Zod schema before persistence logic
- Persistence logic before integration tests

### Parallel Opportunities

- T002 and T003 can run in parallel (different test files)
- T006 and T007 can run in parallel (different test files)
- T009 and T010 are in the same file but sequential
- T011 and T012 can run in parallel (different test scenarios)
- T013, T014, and T015 can all run in parallel (independent edge cases)
- **US4 (Phase 5)** can run in parallel with US2/US3 (Phases 3-4)

---

## Parallel Example: User Story 2

```bash
# Launch both unit test tasks in parallel:
Task T002: "Unit test: Zod schema validation in tests/unit/comparison-payload.test.ts"
Task T003: "Unit test: buildDecisionPoints() structured path in tests/unit/comparison-record.test.ts"

# Then implement sequentially (same dependency chain):
Task T004: "Zod schema in lib/comparison/comparison-payload.ts"
Task T005: "Persistence logic in lib/comparison/comparison-record.ts"
```

## Parallel Example: Cross-Story

```bash
# After Phase 2 completes, run US2 and US4 in parallel:
Phase 3 (US2): T002 → T003 → T004 → T005
Phase 5 (US4): T009 → T010  # Different file, no dependencies on US2
```

---

## Implementation Strategy

### MVP First (User Story 2 Only)

1. Complete Phase 2: Foundational (T001 — type definitions)
2. Complete Phase 3: US2 (T002-T005 — Zod + persistence)
3. **STOP and VALIDATE**: Run unit tests, verify structured data persists correctly
4. This alone enables distinct decision points for new comparisons

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Phase 3 (US2) → Structured data pipeline works → MVP!
3. Phase 4 (US3) → Backward compatibility verified
4. Phase 5 (US4) → AI produces structured data in future comparisons
5. Phase 6 (US1) → End-to-end integration validated
6. Phase 7 → Edge cases and polish

### Parallel Execution Strategy

1. Complete Phase 2 sequentially (single task)
2. Launch in parallel:
   - Track A: Phase 3 (US2) → Phase 4 (US3) → Phase 6 (US1)
   - Track B: Phase 5 (US4)
3. Phase 7 after both tracks complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database migration required — `DecisionPointEvaluation` model already supports all fields
- No UI changes required — existing component renders per-point data
- 4 files modified: `lib/types/comparison.ts`, `lib/comparison/comparison-payload.ts`, `lib/comparison/comparison-record.ts`, `.claude-plugin/commands/ai-board.compare.md`
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
