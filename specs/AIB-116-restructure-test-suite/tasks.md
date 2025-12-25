# Tasks: Restructure Test Suite to Testing Trophy Architecture

**Input**: Design documents from `/specs/AIB-116-restructure-test-suite/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested in the feature specification. Tests will be validated through existing Vitest/Playwright infrastructure.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure) ✅ DONE

**Purpose**: Create Vitest integration test infrastructure

- [x] T001 Create directory structure `tests/fixtures/vitest/` for integration test fixtures
- [x] T002 Create directory structure `tests/integration/` with domain subdirectories (projects/, tickets/, comments/, jobs/, cleanup/)
- [x] T003 [P] Implement API client in `tests/fixtures/vitest/api-client.ts` per contracts/api-client.ts interface

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ DONE

**Purpose**: Core test infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement global setup with worker ID mapping in `tests/fixtures/vitest/global-setup.ts` per research.md pattern
- [x] T005 Implement per-test setup with TestContext in `tests/fixtures/vitest/setup.ts` per contracts/test-context.ts interface
- [x] T006 Modify `vitest.config.mts` to add integration test profile with VITEST_INTEGRATION env var toggle per research.md configuration pattern
- [x] T007 [P] Add `test:integration` script to `package.json` with VITEST_INTEGRATION=1 flag
- [x] T008 Verify worker isolation works by running a simple test that logs projectId across parallel workers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - AI Agent Validates API Changes Quickly (Priority: P1) 🎯 MVP ✅ DONE

**Goal**: Integration tests execute in under 100ms per test, enabling rapid feedback for API changes

**Independent Test**: Run `bun run test:integration` against any API endpoint and verify sub-100ms execution time per test

### Implementation for User Story 1

- [x] T009 [P] [US1] Migrate projects CRUD tests from `tests/e2e/projects/*.spec.ts` to `tests/integration/projects/crud.test.ts`
- [x] T010 [P] [US1] Migrate projects settings tests to `tests/integration/projects/settings.test.ts`
- [x] T011 [P] [US1] Migrate tickets CRUD tests from `tests/e2e/tickets/*.spec.ts` to `tests/integration/tickets/crud.test.ts`
- [x] T012 [P] [US1] Migrate tickets transitions tests to `tests/integration/tickets/transitions.test.ts`
- [x] T013 [P] [US1] Migrate tickets workflows tests to `tests/integration/tickets/workflows.test.ts`
- [x] T014 [P] [US1] Migrate comments CRUD tests from `tests/e2e/comments/*.spec.ts` to `tests/integration/comments/crud.test.ts`
- [x] T015 [P] [US1] Migrate jobs status tests from `tests/e2e/jobs/*.spec.ts` to `tests/integration/jobs/status.test.ts`
- [x] T016 [P] [US1] Migrate cleanup analysis tests from `tests/e2e/cleanup/*.spec.ts` to `tests/integration/cleanup/analysis.test.ts`
- [x] T017 [P] [US1] Migrate database constraint tests (3 files) to appropriate `tests/integration/` domain folders
- [x] T018 [US1] Run full integration suite and verify total execution time under 30 seconds (SC-001)
- [x] T019 [US1] Verify individual test execution averages under 100ms (SC-002)

**Checkpoint**: At this point, User Story 1 should be fully functional - integration tests run fast (~50ms per test)

---

## Phase 4: User Story 2 - CI Pipeline Validates Changes Quickly (Priority: P1) ✅ DONE

**Goal**: CI test job completes in under 2 minutes with both Vitest and Playwright tests

**Independent Test**: Measure total CI test job duration and verify under 2 minutes

### Implementation for User Story 2

- [x] T020 [US2] Update `bun run test` script in `package.json` to run `test:unit && test:integration && test:e2e`
- [x] T021 [US2] Verify CI workflow runs both Vitest and Playwright tests correctly in GitHub Actions
- [x] T022 [US2] Ensure test failure messages clearly indicate which test and assertion failed
- [x] T023 [US2] Measure and document CI test duration before and after migration (target: 40% reduction per SC-003)

**Checkpoint**: At this point, CI pipeline runs faster with Testing Trophy architecture

---

## Phase 5: User Story 3 - AI Agent Writes New API Tests in Vitest (Priority: P2) ✅ DONE

**Goal**: Clear patterns and helpers for writing new integration tests

**Independent Test**: Create a new test file in `tests/integration/` and verify it runs correctly with Vitest

### Implementation for User Story 3

- [x] T024 [P] [US3] Export `getTestContext` from `tests/fixtures/vitest/setup.ts` for use in new tests
- [x] T025 [P] [US3] Export `createAPIClient` factory from `tests/fixtures/vitest/api-client.ts` for custom client creation
- [x] T026 [US3] Add helper methods to TestContext: `createProject`, `createTicket`, `createUser` per contracts/test-context.ts
- [x] T027 [US3] Verify Vitest discovers and runs all tests matching `tests/integration/**/*.test.ts`

**Checkpoint**: At this point, new integration tests can be written using established patterns

---

## Phase 6: User Story 4 - Browser-Required Tests Run in Playwright (Priority: P2) ✅ DONE

**Goal**: Playwright E2E suite contains only browser-required tests (~47 files from ~92)

**Independent Test**: Run Playwright E2E tests and verify they interact with real browser features

### Implementation for User Story 4

- [x] T028 [US4] Audit `tests/e2e/` to identify browser-required tests (OAuth, drag-drop, viewport, keyboard nav, visual state)
- [x] T029 [P] [US4] Retain auth/OAuth tests in `tests/e2e/auth/` (browser redirects, session cookies required)
- [x] T030 [P] [US4] Retain drag-drop tests in `tests/e2e/board/` (DnD Kit requires real DOM events)
- [x] T031 [P] [US4] Retain keyboard navigation tests in `tests/e2e/keyboard/` (real focus management required)
- [x] T032 [P] [US4] Retain viewport tests in `tests/e2e/visual/` (browser window sizing required)
- [x] T033 [US4] Delete Playwright tests that duplicate coverage now in Vitest integration tests
- [x] T034 [US4] Verify E2E suite contains ~40-50 test files (SC-004: down from 92)
- [x] T035 [US4] Verify all existing test coverage is maintained (SC-005: no functionality loses test protection)

**Checkpoint**: At this point, Playwright is reserved for browser-required scenarios only

---

## Phase 7: User Story 5 - Documentation Reflects Testing Strategy (Priority: P3) ✅ DONE

**Goal**: Constitution and CLAUDE.md guide AI agents to use Testing Trophy patterns

**Independent Test**: Read updated documentation and verify it describes Testing Trophy approach

### Implementation for User Story 5

- [x] T036 [P] [US5] Update `.specify/memory/constitution.md` Section III to describe Testing Trophy architecture per FR-009
- [x] T037 [P] [US5] Update `CLAUDE.md` testing section with new commands (`bun run test:integration`) and strategy per FR-010
- [x] T038 [US5] Document when to use Vitest vs Playwright (API tests → Vitest, browser tests → Playwright)
- [x] T039 [US5] Verify documentation accurately describes Testing Trophy (SC-007)

**Checkpoint**: AI agents will follow Testing Trophy patterns when writing tests

---

## Phase 8: Polish & Cross-Cutting Concerns ✅ DONE

**Purpose**: Final validation and cleanup

- [x] T040 Remove any dead test files that were fully migrated to integration tests
- [x] T041 Run quickstart.md validation scenarios to verify all patterns work
- [x] T042 Verify SC-006: New API tests use Vitest, not Playwright (code review check)
- [x] T043 Final run of `bun run test` to verify all test types pass together

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel
  - US3 (P2) and US4 (P2) can proceed in parallel after US1
  - US5 (P3) can proceed after all implementation is complete
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Tests US1 integration alongside E2E
- **User Story 3 (P2)**: Can start after US1 - Builds on established patterns
- **User Story 4 (P2)**: Can start after US1 - Deletes migrated tests
- **User Story 5 (P3)**: Can start after US3/US4 - Documents final architecture

### Within Each User Story

- Migration tasks marked [P] can run in parallel (different test files)
- Verification tasks (T018, T019, T023, T027, etc.) must run after implementation
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 can run in parallel
- T004, T005 must complete before T006 (config depends on setup files)
- T006, T007 can run in parallel
- All migration tasks T009-T017 can run in parallel (different test domains)
- T029-T032 can run in parallel (different E2E categories)
- T036, T037 can run in parallel (different documentation files)

---

## Parallel Example: User Story 1 Migrations

```bash
# Launch all domain migrations together (all marked [P]):
Task: T009 - Migrate projects CRUD to tests/integration/projects/crud.test.ts
Task: T010 - Migrate projects settings to tests/integration/projects/settings.test.ts
Task: T011 - Migrate tickets CRUD to tests/integration/tickets/crud.test.ts
Task: T012 - Migrate tickets transitions to tests/integration/tickets/transitions.test.ts
Task: T013 - Migrate tickets workflows to tests/integration/tickets/workflows.test.ts
Task: T014 - Migrate comments CRUD to tests/integration/comments/crud.test.ts
Task: T015 - Migrate jobs status to tests/integration/jobs/status.test.ts
Task: T016 - Migrate cleanup analysis to tests/integration/cleanup/analysis.test.ts
Task: T017 - Migrate database constraint tests to integration folders
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (migrate to Vitest integration tests)
4. **STOP and VALIDATE**: Run `bun run test:integration` - verify <30s total, <100ms per test
5. Confirm core value: Fast API test feedback

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Fast integration tests (MVP!)
3. Add User Story 2 → Test independently → CI pipeline optimized
4. Add User Story 3 → Test independently → New test patterns documented
5. Add User Story 4 → Test independently → E2E suite cleaned up
6. Add User Story 5 → Test independently → Documentation complete
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (migrations)
   - Developer B: User Story 4 (E2E cleanup)
3. After US1 complete:
   - Developer A: User Story 2 (CI verification)
   - Developer B: User Story 3 (patterns)
4. Finally: User Story 5 (documentation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Migration pattern: Playwright → Vitest using syntax conversion from quickstart.md
- Worker isolation: Projects [1, 2, 4, 5, 6, 7], skip 3 (development)
- Test data: Always use `[e2e]` prefix for cleanup safety
