# Tasks: Health Dashboard - 4 Health Scan Commands

**Input**: Design documents from `/specs/AIB-373-health-dashboard-4/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/command-output.md, quickstart.md

**Tests**: Yes — explicitly requested in plan.md (Task 5) and testing strategy section.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing schemas and understand current command state before making changes

- [ ] T001 Read and catalog the existing Zod schemas in lib/health/report-schemas.ts to confirm ReportIssue, SecurityReport, ComplianceReport, TestsReport, SpecSyncReport structures
- [ ] T002 Read and catalog the existing command files in .claude-plugin/commands/ (ai-board.health-security.md, ai-board.health-compliance.md, ai-board.health-tests.md, ai-board.health-spec-sync.md) to identify all gaps vs Zod schemas
- [ ] T003 [P] Read parseScanReport() and groupIssuesIntoTickets() in lib/health/report-schemas.ts and lib/health/ticket-creation.ts to understand validation and ticket grouping logic

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the test file skeleton that all user story tests will be added to

**⚠️ CRITICAL**: Test file must exist before user story phases begin (TDD approach)

- [ ] T004 Create test file skeleton at tests/unit/health/command-output-validation.test.ts with imports for Zod schemas from lib/health/report-schemas.ts and test suite structure (describe blocks for each scan type)

**Checkpoint**: Test file skeleton ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Security Audit via Workflow (Priority: P1) 🎯 MVP

**Goal**: Update the security scan command to produce JSON output matching the SecurityReport Zod schema

**Independent Test**: Run the Zod SecurityReport schema against the example output from the updated command and verify it passes validation

### Tests for User Story 1

- [ ] T005 [P] [US1] Add unit test: valid SecurityReport with lowercase severity, id fields, type "SECURITY", and generatedTickets passes Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T006 [P] [US1] Add unit test: SecurityReport with uppercase severity FAILS Zod validation (regression guard) in tests/unit/health/command-output-validation.test.ts
- [ ] T007 [P] [US1] Add unit test: SecurityReport missing id field FAILS Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T008 [P] [US1] Add unit test: parseScanReport() correctly parses a valid SecurityReport JSON string in tests/unit/health/command-output-validation.test.ts

### Implementation for User Story 1

- [ ] T009 [US1] Update .claude-plugin/commands/ai-board.health-security.md: fix output format example to use lowercase severity values (high/medium/low), add id field to each issue (format: sec-NNN), add type "SECURITY" to report, add generatedTickets: [] to report, remove summary field from report
- [ ] T010 [US1] Update .claude-plugin/commands/ai-board.health-security.md: add category field documentation mapping to security categories (injection, authentication, sensitive-data, access-control, misconfiguration, dependencies, cryptography)
- [ ] T011 [US1] Update .claude-plugin/commands/ai-board.health-security.md: expand scan instructions with detailed OWASP Top 10 patterns to check (SQL injection, XSS, command injection, exposed secrets, missing auth, insecure dependencies)
- [ ] T012 [US1] Update .claude-plugin/commands/ai-board.health-security.md: add incremental scan instructions (use git diff --name-only for file list when --base-commit provided)
- [ ] T013 [US1] Update .claude-plugin/commands/ai-board.health-security.md: add score calculation guidance (HIGH: -15, MEDIUM: -8, LOW: -3, floor at 0)

**Checkpoint**: Security command produces valid SecurityReport JSON — tests pass

---

## Phase 4: User Story 2 - Compliance Verification Against Constitution (Priority: P1)

**Goal**: Update the compliance scan command to produce JSON output matching the ComplianceReport Zod schema

**Independent Test**: Run the Zod ComplianceReport schema against the example output from the updated command and verify it passes validation with correct category-to-principle mapping

### Tests for User Story 2

- [ ] T014 [P] [US2] Add unit test: valid ComplianceReport with id, severity, type "COMPLIANCE", category mapping to constitution principles, and generatedTickets passes Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T015 [P] [US2] Add unit test: ComplianceReport missing severity field FAILS Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T016 [P] [US2] Add unit test: parseScanReport() correctly parses a valid ComplianceReport JSON string in tests/unit/health/command-output-validation.test.ts

### Implementation for User Story 2

- [ ] T017 [US2] Update .claude-plugin/commands/ai-board.health-compliance.md: add id field to each issue (format: comp-{principle}-NNN), add severity field with mapping (HIGH for Security-First/Database-Integrity, MEDIUM for TypeScript-First/Test-Driven/Component-Driven, LOW for AI-First/style), add type "COMPLIANCE" to report, add generatedTickets: [] to report, remove summary field
- [ ] T018 [US2] Update .claude-plugin/commands/ai-board.health-compliance.md: add constitution file discovery instructions (read .ai-board/memory/constitution.md first, fallback to .claude-plugin/memory/constitution.md, error if neither exists)
- [ ] T019 [US2] Update .claude-plugin/commands/ai-board.health-compliance.md: add per-principle scanning patterns (what to look for per constitution principle: TypeScript-First, Component-Driven, Test-Driven, Security-First, Database-Integrity, AI-First)
- [ ] T020 [US2] Update .claude-plugin/commands/ai-board.health-compliance.md: add incremental scan instructions and score calculation guidance

**Checkpoint**: Compliance command produces valid ComplianceReport JSON — tests pass

---

## Phase 5: User Story 3 - Test Execution with Auto-Fix (Priority: P1)

**Goal**: Update the test scan command to produce JSON output matching the TestsReport Zod schema with autoFixed/nonFixable arrays and auto-fix workflow

**Independent Test**: Run the Zod TestsReport schema against the example output from the updated command and verify it passes validation with correct autoFixed and nonFixable arrays using ReportIssue schema

### Tests for User Story 3

- [ ] T021 [P] [US3] Add unit test: valid TestsReport with autoFixed and nonFixable arrays using ReportIssue schema, type "TESTS", and generatedTickets passes Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T022 [P] [US3] Add unit test: TestsReport using old issues/nonFixable structure (instead of autoFixed/nonFixable) FAILS Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T023 [P] [US3] Add unit test: parseScanReport() correctly parses a valid TestsReport JSON string in tests/unit/health/command-output-validation.test.ts

### Implementation for User Story 3

- [ ] T024 [US3] Update .claude-plugin/commands/ai-board.health-tests.md: restructure report to use autoFixed and nonFixable arrays (both using ReportIssue schema with id, severity, description, file, line), add type "TESTS" to report, add generatedTickets: [] to report, remove summary and status fields
- [ ] T025 [US3] Update .claude-plugin/commands/ai-board.health-tests.md: add auto-fix workflow instructions (detect test command, run tests, for each failure: attempt fix, re-run, commit individually if passes, report as nonFixable if fails)
- [ ] T026 [US3] Update .claude-plugin/commands/ai-board.health-tests.md: document that tests ALWAYS run full suite regardless of --base-commit (FR-005), add issuesFound = autoFixed.length + nonFixable.length, issuesFixed = autoFixed.length
- [ ] T027 [US3] Update .claude-plugin/commands/ai-board.health-tests.md: add score calculation (100 if all pass, proportional reduction per failure)

**Checkpoint**: Tests command produces valid TestsReport JSON — tests pass

---

## Phase 6: User Story 4 - Specification Synchronization Check (Priority: P2)

**Goal**: Update the spec sync command to produce JSON output matching the SpecSyncReport Zod schema with per-spec sync status

**Independent Test**: Run the Zod SpecSyncReport schema against the example output from the updated command and verify it passes validation with correct synced/drifted status entries

### Tests for User Story 4

- [ ] T028 [P] [US4] Add unit test: valid SpecSyncReport with specs array containing synced and drifted entries, type "SPEC_SYNC", and generatedTickets passes Zod validation in tests/unit/health/command-output-validation.test.ts
- [ ] T029 [P] [US4] Add unit test: parseScanReport() correctly parses a valid SpecSyncReport JSON string in tests/unit/health/command-output-validation.test.ts

### Implementation for User Story 4

- [ ] T030 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md: add type "SPEC_SYNC" to report, add generatedTickets: [] to report, remove summary field
- [ ] T031 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md: expand spec comparison instructions listing specific files in specs/specifications/ (endpoints.md, schemas.md, data-model.md, functional specs)
- [ ] T032 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md: add bidirectional drift detection (code without spec AND spec without code)
- [ ] T033 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md: add incremental scan instructions (only check specs impacted by changed files when --base-commit provided)
- [ ] T034 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md: add score calculation (100 if all synced, proportional reduction per drifted spec), issuesFound = count of drifted specs, issuesFixed = 0

**Checkpoint**: Spec sync command produces valid SpecSyncReport JSON — tests pass

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate ticket grouping across all report types and run full test suite

- [ ] T035 [P] Add unit test: groupIssuesIntoTickets() produces correct tickets from SecurityReport in tests/unit/health/command-output-validation.test.ts
- [ ] T036 [P] Add unit test: groupIssuesIntoTickets() produces correct tickets from ComplianceReport in tests/unit/health/command-output-validation.test.ts
- [ ] T037 [P] Add unit test: groupIssuesIntoTickets() produces correct tickets from TestsReport in tests/unit/health/command-output-validation.test.ts
- [ ] T038 Run full test suite (bun run test:unit) to verify all new tests pass and no regressions
- [ ] T039 Run type-check (bun run type-check) and lint (bun run lint) to verify no errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — read-only exploration
- **Foundational (Phase 2)**: Depends on Setup — creates test file skeleton
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1, US2, US3 are all P1 — can proceed in priority order or in parallel
  - US4 is P2 — can run after or in parallel with P1 stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) — No dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Command file updates within a story are sequential (same file)
- Tests across different stories marked [P] can run in parallel

### Parallel Opportunities

- T001, T002, T003 can run in parallel (read-only tasks)
- T005, T006, T007, T008 can run in parallel (US1 tests, different test cases)
- T014, T015, T016 can run in parallel (US2 tests)
- T021, T022, T023 can run in parallel (US3 tests)
- T028, T029 can run in parallel (US4 tests)
- T035, T036, T037 can run in parallel (cross-cutting ticket grouping tests)
- All 4 user story phases can run in parallel (different command files)

---

## Parallel Example: All User Stories

```bash
# After Phase 2 completes, all 4 user stories can execute in parallel:
# Worker 1: US1 — .claude-plugin/commands/ai-board.health-security.md
# Worker 2: US2 — .claude-plugin/commands/ai-board.health-compliance.md
# Worker 3: US3 — .claude-plugin/commands/ai-board.health-tests.md
# Worker 4: US4 — .claude-plugin/commands/ai-board.health-spec-sync.md

# Within US1, tests can run in parallel:
Task: T005 "Valid SecurityReport passes Zod validation"
Task: T006 "Uppercase severity FAILS validation"
Task: T007 "Missing id FAILS validation"
Task: T008 "parseScanReport() parses SecurityReport"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (read existing code)
2. Complete Phase 2: Foundational (create test file)
3. Complete Phase 3: User Story 1 (security command + tests)
4. **STOP and VALIDATE**: Run tests to verify SecurityReport validates against Zod

### Incremental Delivery

1. Complete Setup + Foundational → Test file ready
2. Add User Story 1 (Security) → Test independently → ✓
3. Add User Story 2 (Compliance) → Test independently → ✓
4. Add User Story 3 (Tests Auto-Fix) → Test independently → ✓
5. Add User Story 4 (Spec Sync) → Test independently → ✓
6. Polish: ticket grouping tests, full suite validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once test file skeleton exists, all 4 user stories can run in parallel:
   - Each modifies a different command file
   - Each adds tests to different describe blocks in the shared test file
3. Polish phase validates everything works together

---

## Notes

- All 4 command files are Markdown — changes are to prompt instructions, not TypeScript code
- The only new TypeScript file is the test file: tests/unit/health/command-output-validation.test.ts
- No Prisma schema changes, no API changes, no UI changes
- Score calculation weights are guidance (HIGH: -15, MEDIUM: -8, LOW: -3) — exact values are for the AI agent executing the command
- Commands output ONLY valid JSON to stdout — no additional text (FR-015)
