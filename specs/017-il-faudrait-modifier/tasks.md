# Tasks: E2E Test Data Isolation

**Feature**: 017-il-faudrait-modifier
**Input**: Design documents from `/specs/017-il-faudrait-modifier/`
**Prerequisites**: research.md, data-model.md, contracts/, quickstart.md

## Execution Flow

This implementation follows Test-Driven Development (TDD):
1. Write contract tests that validate selective cleanup behavior (Phase 3.2)
2. Implement cleanup helper changes (Phase 3.3)
3. Migrate existing tests to use `[e2e]` prefix (Phase 3.4)
4. Validate full test suite passes (Phase 3.5)

## Phase 3.1: Setup

- [X] T001 Verify PostgreSQL database is running and accessible
- [X] T002 Verify Prisma client is properly configured
- [X] T003 Create backup of current `tests/helpers/db-cleanup.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [X] T004 [P] Contract test for selective ticket cleanup in `tests/contracts/cleanup-tickets.spec.ts`
- [X] T005 [P] Contract test for selective project cleanup in `tests/contracts/cleanup-projects.spec.ts`
- [X] T006 [P] Contract test for prefix pattern validation in `tests/contracts/test-prefix.spec.ts`

**Validation Checkpoint**: All 3 contract tests must exist and FAIL before proceeding to Phase 3.3 ✅

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [X] T007 Update ticket cleanup in `tests/helpers/db-cleanup.ts` to use selective deletion with `startsWith('[e2e]')`
- [X] T008 Update project cleanup in `tests/helpers/db-cleanup.ts` to delete `[e2e]` projects and recreate with prefix (with exception for projects 1 & 2)
- [X] T009 Verify contract tests now pass (T004-T006) - All 9 tests passing ✅

**Validation Checkpoint**: All contract tests (T004-T006) must PASS before proceeding to Phase 3.4

## Phase 3.4: Test Migration (Systematic File-by-File)

**Category 1: E2E Tests** (20 files in `tests/e2e/`)

- [ ] T010 [P] Add `[e2e]` prefix to `tests/e2e/board-empty.spec.ts`
- [ ] T011 [P] Add `[e2e]` prefix to `tests/e2e/board-multiple.spec.ts`
- [ ] T012 [P] Add `[e2e]` prefix to `tests/e2e/board-responsive.spec.ts`
- [ ] T013 [P] Add `[e2e]` prefix to `tests/e2e/cross-project-prevention.spec.ts`
- [ ] T014 [P] Add `[e2e]` prefix to `tests/e2e/inline-editing.spec.ts`
- [ ] T015 [P] Add `[e2e]` prefix to `tests/e2e/project-board.spec.ts`
- [ ] T016 [P] Add `[e2e]` prefix to `tests/e2e/project-routing.spec.ts`
- [ ] T017 [P] Add `[e2e]` prefix to `tests/e2e/project-validation-404.spec.ts`
- [ ] T018 [P] Add `[e2e]` prefix to `tests/e2e/project-validation-format.spec.ts`
- [ ] T019 [P] Add `[e2e]` prefix to `tests/e2e/ticket-card.spec.ts`
- [ ] T020 [P] Add `[e2e]` prefix to `tests/e2e/ticket-create.spec.ts`
- [ ] T021 [P] Add `[e2e]` prefix to `tests/e2e/ticket-errors.spec.ts`
- [ ] T022 [P] Add `[e2e]` prefix to `tests/e2e/ticket-truncation.spec.ts`
- [ ] T023 [P] Add `[e2e]` prefix to remaining 7 E2E test files

**Category 2: API Tests** (7 files in `tests/api/`)

- [ ] T024 [P] Add `[e2e]` prefix to `tests/api/projects-tickets-get.spec.ts`
- [ ] T025 [P] Add `[e2e]` prefix to `tests/api/projects-tickets-patch.spec.ts`
- [ ] T026 [P] Add `[e2e]` prefix to `tests/api/projects-tickets-post.spec.ts`
- [ ] T027 [P] Add `[e2e]` prefix to `tests/api/tickets-get.spec.ts`
- [ ] T028 [P] Add `[e2e]` prefix to `tests/api/tickets-patch.spec.ts`
- [ ] T029 [P] Add `[e2e]` prefix to `tests/api/tickets-post.spec.ts`
- [ ] T030 [P] Add `[e2e]` prefix to remaining 1 API test file

**Category 3: Integration Tests** (5 files in `tests/integration/`)

- [ ] T031 [P] Add `[e2e]` prefix to `tests/integration/ticket-automode.spec.ts`
- [ ] T032 [P] Add `[e2e]` prefix to `tests/integration/ticket-branch-assignment.spec.ts`
- [ ] T033 [P] Add `[e2e]` prefix to `tests/integration/ticket-branch-validation.spec.ts`
- [ ] T034 [P] Add `[e2e]` prefix to `tests/integration/ticket-defaults.spec.ts`
- [ ] T035 [P] Add `[e2e]` prefix to `tests/integration/ticket-multi-field-update.spec.ts`

**Category 4: Database & Other Tests** (8 files)

- [ ] T036 [P] Add `[e2e]` prefix to `tests/database/ticket-project-constraints.spec.ts`
- [ ] T037 [P] Add `[e2e]` prefix to `tests/project-cascade.spec.ts`
- [ ] T038 [P] Add `[e2e]` prefix to `tests/project-uniqueness.spec.ts`
- [ ] T039 [P] Add `[e2e]` prefix to `tests/foundation.spec.ts`
- [ ] T040 [P] Add `[e2e]` prefix to `tests/drag-drop.spec.ts`
- [ ] T041 [P] Add `[e2e]` prefix to remaining 3 test files in `tests/` root

## Phase 3.5: Validation & Polish

- [ ] T042 Run full test suite to verify zero regressions (`npm run test`)
- [ ] T043 Validate selective cleanup preserves manual data (follow quickstart.md Step 3)
- [ ] T044 Validate selective cleanup preserves manual projects (follow quickstart.md Step 4)
- [ ] T045 Validate test isolation with repeated test runs (follow quickstart.md Step 5)
- [ ] T046 Validate cleanup performance meets <2s target (follow quickstart.md Step 8)
- [ ] T047 Update `CLAUDE.md` with E2E Test Data Isolation best practices
- [ ] T048 Remove backup of original `db-cleanup.ts` if all tests pass

## Dependencies

**Critical Path**:
- T001-T003 (Setup) → T004-T006 (Contract Tests) → T007-T009 (Implementation) → T010-T041 (Migration) → T042-T048 (Validation)

**Test Dependencies**:
- Contract tests (T004-T006) MUST FAIL before implementation (T007-T009)
- Contract tests (T004-T006) MUST PASS before migration (T010-T041)
- Migration (T010-T041) MUST complete before final validation (T042-T048)

**Parallel Execution**:
- T004-T006 can run in parallel (different contract files)
- T010-T023 can run in parallel (different E2E test files)
- T024-T030 can run in parallel (different API test files)
- T031-T035 can run in parallel (different integration test files)
- T036-T041 can run in parallel (different database/other test files)

## Parallel Execution Examples

### Phase 3.2: Contract Tests (Parallel)
```bash
# Launch T004-T006 together (different files, no dependencies):
Task: "Write contract test for selective ticket cleanup in tests/contracts/cleanup-tickets.spec.ts"
Task: "Write contract test for selective project cleanup in tests/contracts/cleanup-projects.spec.ts"
Task: "Write contract test for prefix pattern validation in tests/contracts/test-prefix.spec.ts"
```

### Phase 3.4: E2E Test Migration (Parallel Batches)
```bash
# Batch 1: Launch T010-T015 together
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/board-empty.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/board-multiple.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/board-responsive.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/cross-project-prevention.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/inline-editing.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/e2e/project-board.spec.ts"

# Batch 2: Launch T016-T020 together
# ... and so on
```

### Phase 3.4: API Test Migration (Parallel)
```bash
# Launch T024-T030 together (different API test files):
Task: "Add [e2e] prefix to all ticket titles in tests/api/projects-tickets-get.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/api/projects-tickets-patch.spec.ts"
Task: "Add [e2e] prefix to all ticket titles in tests/api/projects-tickets-post.spec.ts"
# ... and so on
```

## Task Execution Notes

### T004-T006: Contract Test Creation
- Copy test templates from contract specification files
- Ensure tests validate EXACT behavior (selective deletion, prefix matching, performance)
- Tests should FAIL initially (no implementation yet)
- Use Playwright test framework and Prisma client

### T007-T008: Cleanup Implementation
- Modify `tests/helpers/db-cleanup.ts` only
- Replace `deleteMany({})` with `deleteMany({ where: { title: { startsWith: '[e2e]' } } })`
- Add project `deleteMany` with `name` filter
- Add project `upsert` calls for projects 1 and 2 with `[e2e]` prefix
- Ensure deletion order: tickets first, then projects

### T010-T041: Test File Migration
- Pattern: Find all `title: '...'` → Replace with `title: '[e2e] ...'`
- Verify title length doesn't exceed 200 chars (194 + 6 prefix)
- Update assertions if exact title match required (substring matches still work)
- Run individual test file after update to verify it passes
- Commit changes per file for easier rollback if needed

### T042-T048: Validation
- Follow quickstart.md validation steps exactly
- Document any failures or edge cases discovered
- Update CLAUDE.md with new test patterns and conventions
- Keep backup until 100% confident in new implementation

## Validation Checklist

Before marking feature complete:

- [ ] All contract tests (T004-T006) pass
- [ ] All existing tests pass with zero regressions (T042)
- [ ] Manual data preservation validated (T043-T044)
- [ ] Test isolation validated (T045)
- [ ] Performance targets met (<2s cleanup, <500ms per operation) (T046)
- [ ] CLAUDE.md updated with best practices (T047)
- [ ] No [e2e] prefixed data remains in database after cleanup
- [ ] Non-[e2e] data preserved during test execution

## Rollback Procedure

If validation fails:
1. Restore backup of `tests/helpers/db-cleanup.ts` (created in T003)
2. Revert test file changes: `git checkout main -- tests/`
3. Run baseline test suite to verify restoration
4. Investigate failures and re-attempt implementation

## Performance Targets

- Ticket cleanup: <500ms for <100 tickets
- Project cleanup: <100ms for project operations
- Total cleanup: <2s per test execution
- Full test suite: No significant slowdown (baseline ± 10%)

## Notes

- **TDD Workflow**: Tests first (T004-T006), then implementation (T007-T009)
- **Parallel Safety**: All [P] tasks operate on different files
- **Idempotency**: Cleanup functions safe to call multiple times
- **No Schema Changes**: Uses existing `title` and `name` fields
- **Backward Compatible**: Unprefixed tests can coexist during migration
- **Constitutional Compliance**: Prisma ORM only, no raw SQL

## Success Criteria

Feature is complete when:
1. ✅ All contract tests pass (T004-T006, T009)
2. ✅ All 40 test files migrated to use `[e2e]` prefix (T010-T041)
3. ✅ Full test suite passes with zero failures (T042)
4. ✅ Manual data preservation validated (T043-T044)
5. ✅ Performance targets met (T046)
6. ✅ Documentation updated (T047)
