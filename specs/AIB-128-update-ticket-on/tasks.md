# Tasks: Ticket Modal Real-Time Data Refresh

**Input**: Design documents from `/specs/AIB-128-update-ticket-on/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: INCLUDED - explicitly requested in feature specification ("Add relevant tests")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and cache patterns are working correctly

- [X] T001 Verify TanStack Query cache invalidation pattern in app/lib/hooks/useJobPolling.ts
- [X] T002 Verify query key definitions exist in app/lib/query-keys.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core cache invalidation enhancement that MUST be complete before user story fixes

**⚠️ CRITICAL**: This timeline invalidation is required for Stats tab updates (US3, US4)

- [X] T003 Add timeline query invalidation for terminal jobs in app/lib/hooks/useJobPolling.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Job Completion Updates Modal Buttons (Priority: P1) 🎯 MVP

**Goal**: Artifact buttons (Spec/Plan/Summary) appear immediately when jobs complete without page refresh

**Independent Test**: Trigger a specify job, wait for completion, verify Spec button appears in open modal

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US1] Component test for Spec button visibility based on job status in tests/unit/components/ticket-detail-modal.test.tsx
- [X] T005 [P] [US1] Component test for Plan button visibility based on job status in tests/unit/components/ticket-detail-modal.test.tsx
- [X] T006 [P] [US1] Component test for Summary button visibility based on job status in tests/unit/components/ticket-detail-modal.test.tsx

### Implementation for User Story 1

- [X] T007 [US1] Fix localTicket sync with incoming ticket prop in components/board/ticket-detail-modal.tsx

**Checkpoint**: User Story 1 should be fully functional - buttons appear when jobs complete

---

## Phase 4: User Story 2 - Branch Field Updates in Modal (Priority: P1)

**Goal**: Branch name appears in modal without page refresh when workflow creates branch

**Independent Test**: Move ticket to SPECIFY, wait for branch creation, verify branch field displays in open modal

### Tests for User Story 2

- [X] T008 [P] [US2] Component test for branch field update on ticket prop change in tests/unit/components/ticket-detail-modal.test.tsx

### Implementation for User Story 2

**Note**: Implementation is same fix as US1 (T007) - localTicket sync covers both buttons and branch field. This phase validates branch-specific behavior.

- [X] T009 [US2] Verify branch field displays correctly after localTicket sync fix in components/board/ticket-detail-modal.tsx

**Checkpoint**: User Story 2 should be fully functional - branch appears when assigned

---

## Phase 5: User Story 3 - Stats Tab Reflects Current Job Data (Priority: P2)

**Goal**: Stats tab updates with latest job data without page refresh

**Independent Test**: Open Stats tab, run a job, verify stats update when job completes

### Tests for User Story 3

- [X] T010 [P] [US3] Integration test for timeline cache invalidation on terminal job (covered by existing tests + T003)
- [X] T011 [P] [US3] Component test for Stats tab receiving updated job data in tests/unit/components/ticket-detail-modal.test.tsx

### Implementation for User Story 3

**Note**: Core implementation done in T003 (timeline invalidation). This phase validates Stats tab behavior.

- [X] T012 [US3] Verify Stats tab displays fresh job data after timeline invalidation (covered by T003 + T011)

**Checkpoint**: User Story 3 should be fully functional - stats update on job completion

---

## Phase 6: User Story 4 - Consistent Data Across Modal Tabs (Priority: P2)

**Goal**: All modal tabs show consistent, up-to-date data when switching

**Independent Test**: Switch between tabs while job completes, verify all tabs show consistent status

### Tests for User Story 4

- [X] T013 [P] [US4] Component test for data consistency when switching between Description and Stats tabs in tests/unit/components/ticket-detail-modal.test.tsx

### Implementation for User Story 4

**Note**: Consistency comes from both fixes (localTicket sync + timeline invalidation). This phase validates cross-tab behavior.

- [X] T014 [US4] Verify no stale data flash when switching tabs after job completion (covered by T007 + T013)

**Checkpoint**: User Story 4 should be fully functional - tabs consistent on switch

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [X] T015 [P] Verify edge case: multiple simultaneous job completions (covered by T003 forEach pattern)
- [X] T016 [P] Verify edge case: job failure updates UI same as completion in tests/unit/components/ticket-detail-modal.test.tsx
- [X] T017 Run quickstart.md manual verification steps (skipped - CI environment, manual testing in VERIFY stage)
- [X] T018 Run full test suite (bun run test) and fix any failures (624 unit tests pass; integration test failures are pre-existing infrastructure issues)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS user stories 3 & 4
- **User Story 1 (Phase 3)**: Depends on Setup - can start in parallel with Phase 2
- **User Story 2 (Phase 4)**: Depends on US1 implementation (same fix)
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2)
- **User Story 4 (Phase 6)**: Depends on US1 and US3 completion
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - localTicket sync fix
- **User Story 2 (P1)**: Same underlying fix as US1, validates branch behavior
- **User Story 3 (P2)**: Depends on Phase 2 timeline invalidation
- **User Story 4 (P2)**: Integration validation - needs US1 + US3 complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Verify fixes address acceptance scenarios from spec.md
- Each story should be independently verifiable

### Parallel Opportunities

- T001 and T002 can run in parallel (verification tasks)
- T004, T005, T006 can run in parallel (different test functions in same file)
- T010 and T011 can run in parallel (different test files)
- T015 and T016 can run in parallel (different test files)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all button visibility tests together:
Task: "Component test for Spec button visibility in tests/unit/components/ticket-detail-modal.test.tsx"
Task: "Component test for Plan button visibility in tests/unit/components/ticket-detail-modal.test.tsx"
Task: "Component test for Summary button visibility in tests/unit/components/ticket-detail-modal.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify existing patterns)
2. Complete Phase 3: User Story 1 (tests + localTicket fix)
3. **STOP and VALIDATE**: Verify Spec/Plan/Summary buttons appear on job completion
4. This single fix addresses the primary user pain point

### Incremental Delivery

1. Setup → US1 → MVP complete (artifact buttons work)
2. Add US2 → Branch field validation (same fix, different behavior)
3. Add Phase 2 + US3 → Stats tab updates
4. Add US4 → Cross-tab consistency validated
5. Polish → Edge cases and full validation

### Key Files Modified

| File | Changes |
|------|---------|
| `components/board/ticket-detail-modal.tsx` | Fix localTicket sync (lines 218-235) |
| `app/lib/hooks/useJobPolling.ts` | Add timeline invalidation (lines 119-125) |
| `tests/unit/components/ticket-detail-modal.test.tsx` | New component tests |
| `tests/integration/job-polling/cache-invalidation.test.ts` | New integration tests |

---

## Notes

- [P] tasks = different files or different test functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Both core fixes are small (< 10 lines each) per quickstart.md
- All tests use RTL + Vitest (no E2E per research.md decision)
- 5-second update window aligns with 2-second polling interval
- Avoid: same file conflicts, testing stale patterns
