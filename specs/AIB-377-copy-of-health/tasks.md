# Tasks: Health Dashboard - Workflow health-scan.yml

**Input**: Design documents from `/specs/AIB-377-copy-of-health/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per plan.md testing strategy (unit tests for pure utilities, integration tests for API flows).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed — feature extends existing `lib/health/` and `.github/workflows/` directories.

- [x] T001 Verify existing health infrastructure files exist and review types in lib/health/types.ts, lib/health/report-schemas.ts, lib/health/score-calculator.ts, and lib/health/scan-dispatch.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create static scan type → command mapping utility in lib/health/scan-commands.ts with getScanCommand() function and SCAN_COMMAND_MAP constant per contracts/health-scan-workflow.ts
- [x] T003 [P] Create unit tests for scan command mapping (all 4 types + unknown type error) in tests/unit/health/scan-commands.test.ts

**Checkpoint**: Foundation ready — scan command mapping available for workflow and all user stories

---

## Phase 3: User Story 1 - Execute a Health Scan via Workflow (Priority: P1) 🎯 MVP

**Goal**: Workflow clones target repo, updates scan to RUNNING, executes scan command, and reports COMPLETED with score, issues, and report.

**Independent Test**: Dispatch workflow with valid inputs for any scan type; verify HealthScan transitions PENDING → RUNNING → COMPLETED with valid score and report.

### Tests for User Story 1

- [x] T004 [P] [US1] Create integration test for scan status callback flow (PENDING → RUNNING → COMPLETED) with score and report validation in tests/integration/health/scan-status-tickets.test.ts

### Implementation for User Story 1

- [x] T005 [US1] Create health-scan.yml workflow in .github/workflows/health-scan.yml with workflow_dispatch inputs (scan_id, project_id, scan_type, base_commit, head_commit, githubRepository)
- [x] T006 [US1] Implement workflow step 1: checkout target repository with actions/checkout (repository: inputs.githubRepository, fetch-depth: 0) in .github/workflows/health-scan.yml
- [x] T007 [US1] Implement workflow step 2: update scan status to RUNNING via curl PATCH to /api/projects/{project_id}/health/scans/{scan_id}/status with Bearer WORKFLOW_API_TOKEN in .github/workflows/health-scan.yml
- [x] T008 [US1] Implement workflow step 3: map scanType to command using static case statement (SECURITY→health-security, COMPLIANCE→health-compliance, TESTS→health-tests, SPEC_SYNC→health-spec-sync) in .github/workflows/health-scan.yml
- [x] T009 [US1] Implement workflow step 4: execute scan command via Claude Code CLI with baseCommit/headCommit arguments and capture JSON output in .github/workflows/health-scan.yml
- [x] T010 [US1] Implement workflow step 5: parse scan JSON output and update status to COMPLETED with score, report, issuesFound, issuesFixed via PATCH callback in .github/workflows/health-scan.yml

**Checkpoint**: User Story 1 complete — workflow can execute all 4 scan types and report results back to the API

---

## Phase 4: User Story 2 - Automatic Ticket Creation from Scan Results (Priority: P1)

**Goal**: After scan completion, parse structured report and create grouped remediation tickets (INBOX/QUICK) based on scan-type-specific rules.

**Independent Test**: Provide scan reports with known issues; verify correct number of tickets with proper titles, descriptions, and grouping.

### Tests for User Story 2

- [x] T011 [P] [US2] Create unit tests for ticket grouping logic — SECURITY (by severity), COMPLIANCE (by principle), TESTS (per unfixable test), SPEC_SYNC (per desynchronized spec), and zero-issues case in tests/unit/health/ticket-creation.test.ts

### Implementation for User Story 2

- [x] T012 [US2] Create remediation ticket grouping utility with RemediationTicket interface and groupIssuesIntoTickets() function handling all 4 scan type grouping rules in lib/health/ticket-creation.ts
- [x] T013 [US2] Add workflow step 6: after COMPLETED status, iterate scan report issues, call groupIssuesIntoTickets(), and create tickets via POST /api/projects/{projectId}/tickets with curl in .github/workflows/health-scan.yml

**Checkpoint**: User Story 2 complete — scan results automatically produce grouped remediation tickets

---

## Phase 5: User Story 3 - Incremental Scanning (Priority: P2)

**Goal**: When baseCommit is provided, scan only analyzes changes between baseCommit and headCommit. When baseCommit is empty, perform full scan.

**Independent Test**: Run a scan with baseCommit='' (full scan), then with baseCommit set (incremental scan); verify commit arguments are passed correctly to the scan command.

### Tests for User Story 3

- [x] T014 [P] [US3] Add integration test case for incremental scan — verify baseCommit and headCommit are passed through status callback in tests/integration/health/scan-status-tickets.test.ts

### Implementation for User Story 3

- [x] T015 [US3] Ensure workflow passes baseCommit and headCommit arguments to Claude Code CLI scan command, with empty baseCommit triggering full scan behavior in .github/workflows/health-scan.yml

**Checkpoint**: User Story 3 complete — workflow supports both full and incremental scans based on commit range

---

## Phase 6: User Story 4 - Health Score Recalculation (Priority: P2)

**Goal**: After successful scan, project's HealthScore is updated with module sub-score and globalScore is recalculated.

**Independent Test**: Complete a scan with a score; verify HealthScore record is upserted with correct module sub-score and recalculated global score.

### Tests for User Story 4

- [x] T016 [P] [US4] Add integration test case for score recalculation — verify HealthScore upsert after COMPLETED status update with score in tests/integration/health/scan-status-tickets.test.ts

### Implementation for User Story 4

No new implementation needed — the existing PATCH `/api/projects/{projectId}/health/scans/{scanId}/status/route.ts` already handles HealthScore upsert and globalScore recalculation via `calculateGlobalScore()` when status transitions to COMPLETED with a score. The workflow's COMPLETED callback (T010) already sends the score.

- [x] T017 [US4] Verify that the workflow COMPLETED status payload includes score field and that existing status endpoint correctly triggers HealthScore upsert and globalScore recalculation — document verification in .github/workflows/health-scan.yml

**Checkpoint**: User Story 4 complete — health scores update automatically after each successful scan

---

## Phase 7: User Story 5 - Scan Failure Handling (Priority: P2)

**Goal**: On any error (clone failure, command failure, parse failure), capture error and update scan to FAILED with descriptive message. No score or ticket changes.

**Independent Test**: Trigger a scan expected to fail; verify scan transitions to FAILED with error message and no HealthScore changes.

### Tests for User Story 5

- [x] T018 [P] [US5] Add integration test case for FAILED status update — verify errorMessage is stored and no HealthScore changes occur in tests/integration/health/scan-status-tickets.test.ts

### Implementation for User Story 5

- [x] T019 [US5] Implement workflow error handling: wrap clone, command execution, and JSON parse steps in error capture; on failure, PATCH status to FAILED with stderr truncated to 2000 chars in .github/workflows/health-scan.yml

**Checkpoint**: User Story 5 complete — all failure paths produce clean FAILED status with actionable error messages

---

## Phase 8: User Story 6 - Telemetry Recording (Priority: P3)

**Goal**: Record durationMs, tokensUsed, and costUsd on every scan completion or failure.

**Independent Test**: Run a scan; verify telemetry fields are populated on the HealthScan record.

### Tests for User Story 6

- [x] T020 [P] [US6] Add integration test case for telemetry — verify durationMs is recorded on both COMPLETED and FAILED status updates in tests/integration/health/scan-status-tickets.test.ts

### Implementation for User Story 6

- [x] T021 [US6] Add telemetry capture to workflow: track duration via bash $SECONDS, extract tokensUsed and costUsd from Claude Code CLI --json output, include in both COMPLETED and FAILED status callbacks in .github/workflows/health-scan.yml

**Checkpoint**: User Story 6 complete — all scan executions have telemetry data for cost tracking and performance monitoring

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-cutting improvements

- [ ] T022 Run bun run type-check to verify all new TypeScript files pass strict type checking
- [ ] T023 Run bun run lint to verify all new files pass ESLint rules
- [ ] T024 Run all health tests (bun run test:unit -- tests/unit/health/ && bun run test:integration -- tests/integration/health/) to verify full test suite passes
- [ ] T025 Run quickstart.md validation — verify all key files exist and match the implementation order

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel after foundational
  - US3, US4, US5 (P2) can proceed in parallel after US1 workflow skeleton exists
  - US6 (P3) can proceed after US1 workflow skeleton exists
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — creates the core workflow file
- **US2 (P1)**: Can start after Foundational (Phase 2) — ticket-creation.ts is independent; workflow step depends on US1 workflow existing
- **US3 (P2)**: Depends on US1 workflow skeleton (adds commit argument passing)
- **US4 (P2)**: Depends on US1 workflow COMPLETED callback (verifies score payload)
- **US5 (P2)**: Depends on US1 workflow skeleton (adds error handling wrapper)
- **US6 (P3)**: Depends on US1 workflow skeleton (adds telemetry capture)

### Within Each User Story

- Tests written before or in parallel with implementation
- Utilities (scan-commands.ts, ticket-creation.ts) before workflow steps
- Core workflow steps before error handling and telemetry additions

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T004 and T011 can run in parallel (different test files)
- T011 and T012 can run in parallel (test file vs utility file)
- T014, T016, T018, T020 can run in parallel (all add test cases to integration test file — if file is structured with separate describe blocks)
- US1 implementation (T005-T010) and US2 utility (T012) can run in parallel

---

## Parallel Example: User Story 1 + User Story 2

```bash
# After Foundational phase completes, launch in parallel:

# Thread 1: US1 workflow creation
Task: T005 "Create health-scan.yml workflow in .github/workflows/health-scan.yml"
Task: T006 "Implement checkout step"
Task: T007 "Implement RUNNING status update"
# ... sequential within US1

# Thread 2: US2 utility + tests (independent files)
Task: T011 "Unit tests for ticket grouping in tests/unit/health/ticket-creation.test.ts"
Task: T012 "Ticket grouping utility in lib/health/ticket-creation.ts"
# T013 waits for US1 workflow to exist
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify existing infrastructure)
2. Complete Phase 2: Foundational (scan-commands.ts + tests)
3. Complete Phase 3: User Story 1 (core workflow execution)
4. **STOP and VALIDATE**: Test US1 independently — workflow runs a scan and reports results
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Core scan execution works (MVP!)
3. Add US2 → Test independently → Remediation tickets created automatically
4. Add US3 + US4 + US5 → Test independently → Incremental scans, scores, error handling
5. Add US6 → Test independently → Full telemetry coverage
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, launch in parallel:
   - Parallel task 1: US1 (workflow core) + US2 (ticket utility — independent file)
3. Once US1 workflow skeleton exists:
   - Parallel task 2: US3 + US4 + US5 (all add to workflow, but different sections)
4. Final: US6 (telemetry addition)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The workflow file (.github/workflows/health-scan.yml) is the central artifact — most user stories add steps to it
- Existing API endpoints (status PATCH, ticket POST) are reused, not modified
- scan-commands.ts and ticket-creation.ts are pure functions — easy to unit test
- Integration tests validate the API contract; workflow YAML is not directly testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
