# Tasks: Health Scan Commands (security, compliance, tests, spec-sync)

**Input**: Design documents from `/specs/AIB-378-copy-of-health/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Existing unit tests in `tests/unit/health/` already cover report schema validation, command mapping, score calculation, and ticket creation. No new test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and align shared output format across all commands

- [ ] T001 Verify existing lib/health/types.ts exports match the ScanCommandOutput contract in specs/AIB-378-copy-of-health/contracts/scan-command-output.ts
- [ ] T002 Verify existing lib/health/report-schemas.ts Zod schemas accept the exact JSON fields defined in specs/AIB-378-copy-of-health/data-model.md (score, issuesFound, issuesFixed, report, tokensUsed, costUsd)
- [ ] T003 Verify existing lib/health/scan-commands.ts SCAN_COMMAND_MAP maps all 4 types: SECURITY→health-security, COMPLIANCE→health-compliance, TESTS→health-tests, SPEC_SYNC→health-spec-sync

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure shared argument handling and output format instructions are consistent across all 4 command files before updating individual commands

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Review and update shared argument handling instructions in all 4 command files (.claude-plugin/commands/ai-board.health-security.md, ai-board.health-compliance.md, ai-board.health-tests.md, ai-board.health-spec-sync.md) to ensure consistent --base-commit and --head-commit parameter documentation
- [ ] T005 Review and update shared JSON output base structure instructions in all 4 command files to ensure they specify the exact ScanCommandOutput fields: score (0-100), issuesFound, issuesFixed, report, tokensUsed, costUsd

**Checkpoint**: Foundation ready - all commands share consistent argument handling and base output format

---

## Phase 3: User Story 1 - Security Audit of Project Code (Priority: P1) MVP

**Goal**: health-security command produces a valid SecurityReportPayload JSON report with issues grouped by severity (HIGH/MEDIUM/LOW), supporting both full repo and incremental scanning

**Independent Test**: Run the security scan command against a repository with known vulnerabilities and verify the JSON report correctly identifies them with file, line, severity, category, and description fields matching the SecurityIssue schema

### Implementation for User Story 1

- [ ] T006 [US1] Review and update security scan instruction file .claude-plugin/commands/ai-board.health-security.md to ensure scan categories cover all FR-003 requirements: injection (SQL, XSS, command), authentication/authorization flaws, exposed secrets, vulnerable dependencies, OWASP Top 10, input validation gaps, error message information leakage
- [ ] T007 [US1] Update .claude-plugin/commands/ai-board.health-security.md output format section to ensure SecurityReportPayload matches data-model.md: report.issues[] with severity (HIGH|MEDIUM|LOW), file, line, description, category fields; report.summary string
- [ ] T008 [US1] Update .claude-plugin/commands/ai-board.health-security.md score calculation instructions to match SCORE_RULES: score = 100 - (HIGH*15 + MEDIUM*5 + LOW*1), floor 0
- [ ] T009 [US1] Update .claude-plugin/commands/ai-board.health-security.md incremental scan instructions: when --base-commit provided, run git diff to get changed files and limit analysis to diff only; when absent, scan entire repository
- [ ] T010 [US1] Update .claude-plugin/commands/ai-board.health-security.md edge case handling: baseCommit not found falls back to full scan with note; empty repo returns score 100 with empty issues and summary noting no analyzable code

**Checkpoint**: health-security command fully specified — produces valid SecurityReportPayload JSON

---

## Phase 4: User Story 2 - Automated Test Execution with Auto-Fix (Priority: P1)

**Goal**: health-tests command runs the full test suite, auto-fixes failing tests where possible, commits fixes, and reports results as a valid TestsReportPayload JSON

**Independent Test**: Run the tests scan against a project with known test failures (some fixable, some not) and verify the JSON report accurately counts passed/failed/auto-fixed/non-fixable tests and that auto-fix commits appear on the branch

### Implementation for User Story 2

- [ ] T011 [US2] Review and update test scan instruction file .claude-plugin/commands/ai-board.health-tests.md to ensure test command detection logic matches research.md: priority order test:unit > test > vitest > jest, fallback to bun run test
- [ ] T012 [US2] Update .claude-plugin/commands/ai-board.health-tests.md output format section to ensure TestsReportPayload matches data-model.md: report.issues[] with file, description, status="fixed"; report.nonFixable[] with file, description, reason; report.summary string
- [ ] T013 [US2] Update .claude-plugin/commands/ai-board.health-tests.md auto-fix workflow instructions: for each failing test analyze error, attempt fix, re-run specific test to verify, commit fix individually to branch; report failed attempts as nonFixable with reason
- [ ] T014 [US2] Update .claude-plugin/commands/ai-board.health-tests.md score calculation instructions to match SCORE_RULES: score = (passed / total) * 100, adjusted for auto-fixed (auto-fixed count as passed)
- [ ] T015 [US2] Update .claude-plugin/commands/ai-board.health-tests.md to explicitly state it always runs full suite (FR-011) — ignores --base-commit parameter; document edge case when no test command found in package.json (report error issue)
- [ ] T016 [US2] Update .claude-plugin/commands/ai-board.health-tests.md edge case handling: all tests pass returns perfect score with zero failures and zero auto-fixes; no test command detected reports error issue

**Checkpoint**: health-tests command fully specified — produces valid TestsReportPayload JSON with auto-fix commits

---

## Phase 5: User Story 3 - Compliance Verification Against Project Constitution (Priority: P2)

**Goal**: health-compliance command dynamically reads the target project's constitution and evaluates code against each principle, producing a valid ComplianceReportPayload JSON

**Independent Test**: Run the compliance scan against a project with a known constitution and intentional violations, then verify each principle's evaluation and that violations reference the correct files and lines

### Implementation for User Story 3

- [ ] T017 [US3] Review and update compliance scan instruction file .claude-plugin/commands/ai-board.health-compliance.md to ensure constitution discovery matches research.md: check .ai-board/memory/constitution.md > .claude-plugin/memory/constitution.md > CLAUDE.md in order
- [ ] T018 [US3] Update .claude-plugin/commands/ai-board.health-compliance.md output format section to ensure ComplianceReportPayload matches data-model.md: report.issues[] with category (principle name), file, line, description; report.summary string
- [ ] T019 [US3] Update .claude-plugin/commands/ai-board.health-compliance.md to ensure per-principle evaluation with pass/partial/fail status is reflected in the report summary and issue categorization
- [ ] T020 [US3] Update .claude-plugin/commands/ai-board.health-compliance.md score calculation instructions to match SCORE_RULES: score = 100 - (fail*20 + partial*5) per principle, floor 0
- [ ] T021 [US3] Update .claude-plugin/commands/ai-board.health-compliance.md incremental scan instructions: when --base-commit provided, analyze only diff; when absent, scan entire repository
- [ ] T022 [US3] Update .claude-plugin/commands/ai-board.health-compliance.md edge case handling: no constitution found reports gracefully with score 0; principles with no corresponding code patterns marked as pass; full compliance returns score 100 with all principles pass

**Checkpoint**: health-compliance command fully specified — produces valid ComplianceReportPayload JSON

---

## Phase 6: User Story 4 - Specification Synchronization Check (Priority: P2)

**Goal**: health-spec-sync command compares specs/specifications/ against actual implementation and produces a valid SpecSyncReportPayload JSON with per-spec sync status

**Independent Test**: Run the spec-sync scan against a project where specs intentionally differ from implementation and verify the report identifies each drift with correct spec name, drift description, and affected files

### Implementation for User Story 4

- [ ] T023 [US4] Review and update spec-sync scan instruction file .claude-plugin/commands/ai-board.health-spec-sync.md to ensure it reads each file in specs/specifications/ and compares declared endpoints/models/behaviors against codebase implementation
- [ ] T024 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md output format section to ensure SpecSyncReportPayload matches data-model.md: report.specs[] with specPath, status (synced|drifted), drift (optional string when drifted); report.summary string
- [ ] T025 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md to detect drift in both directions per FR-013: features specified but absent/modified in code, and code not covered by any spec
- [ ] T026 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md score calculation instructions to match SCORE_RULES: score = (synced / total) * 100
- [ ] T027 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md incremental scan instructions: when --base-commit provided, identify impacted specs from diff and only evaluate those; when absent, compare all specs
- [ ] T028 [US4] Update .claude-plugin/commands/ai-board.health-spec-sync.md edge case handling: no specs directory returns score 100 with empty specs list and note; all specs synced returns perfect score; missing implementation identified with spec name and expected behavior

**Checkpoint**: health-spec-sync command fully specified — produces valid SpecSyncReportPayload JSON

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that all commands produce workflow-compatible output

- [ ] T029 Validate all 4 command files produce JSON output ONLY to stdout — no extra text, logs, markdown formatting, or code fences per plan.md Layer 5 requirement
- [ ] T030 Validate issuesFound field documentation: must equal total issue count across all arrays (issues.length for security/compliance, issues.length + nonFixable.length for tests, drifted count for spec-sync)
- [ ] T031 Validate issuesFixed field documentation: must equal issues.length for tests (auto-fixed count), 0 for all other scan types
- [ ] T032 Cross-check all 4 command files against lib/health/report-schemas.ts Zod schemas to confirm field names, types, and required/optional status are aligned
- [ ] T033 Run quickstart.md validation — verify command execution flow matches the documented workflow integration in specs/AIB-378-copy-of-health/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (security) and US2 (tests) are both P1 — can proceed in parallel
  - US3 (compliance) and US4 (spec-sync) are both P2 — can proceed in parallel
  - All 4 stories are independent of each other
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 - Security (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 - Tests (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 3 - Compliance (P2)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 4 - Spec Sync (P2)**: Can start after Phase 2 - No dependencies on other stories

### Within Each User Story

- Review existing command file first (understand current state)
- Update output format to match data-model.md contracts
- Update score calculation to match SCORE_RULES
- Update argument handling (incremental vs full scan)
- Update edge case handling last
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (different files)
- T004, T005 can run in parallel (shared concerns but different aspects)
- All 4 user stories (Phases 3-6) can execute in parallel after Phase 2
- Within each story, output format and score calculation tasks are sequential (same file)
- T029, T030, T031, T032 in Polish phase can run in parallel

---

## Parallel Example: User Story 1 (Security) and User Story 2 (Tests)

```bash
# After Phase 2 completes, launch both P1 stories in parallel:
Task: "Review and update security scan .claude-plugin/commands/ai-board.health-security.md" (US1)
Task: "Review and update test scan .claude-plugin/commands/ai-board.health-tests.md" (US2)

# Similarly, launch both P2 stories in parallel:
Task: "Review and update compliance scan .claude-plugin/commands/ai-board.health-compliance.md" (US3)
Task: "Review and update spec-sync scan .claude-plugin/commands/ai-board.health-spec-sync.md" (US4)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (verify existing infrastructure)
2. Complete Phase 2: Foundational (shared argument/output format)
3. Complete Phase 3: User Story 1 - Security (P1)
4. Complete Phase 4: User Story 2 - Tests (P1)
5. **STOP and VALIDATE**: Both P1 commands produce valid JSON matching schemas
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 (Security) -> Validate independently -> P1 partial
3. Add User Story 2 (Tests) -> Validate independently -> P1 complete (MVP!)
4. Add User Story 3 (Compliance) -> Validate independently -> P2 partial
5. Add User Story 4 (Spec Sync) -> Validate independently -> P2 complete
6. Polish phase -> All commands validated end-to-end

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (Security) + User Story 2 (Tests)
   - Parallel task 2: User Story 3 (Compliance) + User Story 4 (Spec Sync)
3. Stories complete and validate independently
4. Polish phase runs after all stories complete

---

## Notes

- All 4 command instruction files already exist — tasks focus on reviewing, updating, and aligning them with the typed schemas
- All lib/health/ infrastructure already exists (built by AIB-377) — no new TypeScript implementation needed
- Existing tests in tests/unit/health/ already cover schema validation — no new test tasks
- Commands are AI instruction files (.md), not executable code — "implementation" means updating instructions
- Each command file is independent (different .md file) — parallel execution is safe
- Output must be ONLY valid JSON — commands must not produce any non-JSON text on stdout
