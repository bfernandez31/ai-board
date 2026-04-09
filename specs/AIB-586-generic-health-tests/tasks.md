# Tasks: Generic Health Tests — Make TESTS Scan Work on Any Project

**Input**: Design documents from `/specs/AIB-586-generic-health-tests/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks included by default (constitution). Shell scripts have no existing test coverage — all test tasks create new files.

**Organization**: Tasks grouped by user story. US1 and US2 (both P1) can proceed in parallel. US3 and US4 (both P2) depend on US1's orchestrator.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — all work modifies existing scripts or creates new scripts in existing directories.

- [x] T001 Review existing orchestrator behavior in `scripts/run-health-tests.sh` (lines 1-234) to capture all patterns for replication
- [x] T002 [P] Review existing test runner behavior in `scripts/run-tests-with-reports.sh` to capture report schemas and exit patterns
- [x] T003 [P] Review existing stack detection in `.github/scripts/detect-stack.sh` (lines 342-415, 593-648) to understand detection and config generation patterns

---

## Phase 2: User Story 2 — Stack Detection Generates Test Configuration (Priority: P1)

**Goal**: `detect-stack.sh` auto-detects test commands, test framework, E2E presence, type-check, and lint commands, writing them to `config.yml` during onboarding.

**Independent Test**: Run `detect-stack.sh` on mock project directories with different stacks and verify generated `config.yml` contains correct `testing.*` and `commands.*` fields.

### Tests for User Story 2
**NOTE: No existing test files cover `detect-stack.sh`. All tests are new.**

- [x] T004 [P] [US2] Create shell integration tests for test command detection across stacks (JS/TS, Python, Rust, Go, Ruby, PHP) in `tests/unit/scripts/detect-stack-test-commands.test.ts`
- [x] T005 [P] [US2] Create shell integration tests for E2E framework detection (Playwright, Cypress, Selenium) in `tests/unit/scripts/detect-stack-e2e.test.ts`
- [x] T006 [P] [US2] Create shell integration tests for type-check and lint command detection in `tests/unit/scripts/detect-stack-lint-typecheck.test.ts`

### Implementation for User Story 2

- [x] T007 [US2] Add `detect_test_commands()` function to `.github/scripts/detect-stack.sh` — detect test commands per language/package-manager (JS/TS with bun/npm/yarn/pnpm, Python pytest, Rust cargo test, Go go test, Ruby rspec, PHP phpunit, Java maven/gradle) per contract `contracts/config-yml-testing.md`
- [x] T008 [US2] Add `detect_e2e_framework()` function to `.github/scripts/detect-stack.sh` — detect Playwright/Cypress/Selenium from dependency files, set `E2E_DETECTED` and `E2E_FRAMEWORK` variables
- [x] T009 [US2] Add `detect_lint_typecheck()` function to `.github/scripts/detect-stack.sh` — detect lint and type-check commands per language (JS/TS scripts, Python ruff/flake8/mypy/pyright, Rust clippy/check, Go vet)
- [x] T010 [US2] Update `generate_config_yml()` in `.github/scripts/detect-stack.sh` to emit `testing:` section (`framework`, `e2e`, `e2e_framework`) and extended `commands:` (`test`, `type_check`, `lint`) using detected values
- [x] T011 [US2] Update `generate_analysis_json()` in `.github/scripts/detect-stack.sh` to include new detection results (test commands, E2E, lint, type-check)

**Checkpoint**: Stack detection produces correct `testing` and `commands` sections for all supported stacks.

---

## Phase 3: User Story 1 — TESTS Scan on External Project (Priority: P1) MVP

**Goal**: TESTS health scan reads test commands and framework from `config.yml`, runs tests, parses results using framework-specific parsers, scores, and runs fix loop — working on any project without custom scripts.

**Independent Test**: Trigger a TESTS health scan on any repo with `commands.test` in `.ai-board/config.yml` and verify results are produced with correct pass/fail counts and score.

### Tests for User Story 1
**NOTE: No existing test files cover health scan shell scripts. All tests are new.**

- [x] T012 [P] [US1] Create tests for all framework-specific parsers (vitest, jest, pytest, cargo-test, go-test, rspec, phpunit, exit-code fallback) in `tests/unit/scripts/test-report-parsers.test.ts` per contract `contracts/test-report-parsers.md`
- [x] T013 [P] [US1] Create tests for config-driven test runner (single command mode and granular mode, server startup, reporter flags) in `tests/unit/scripts/run-tests-with-reports.test.ts`
- [x] T014 [P] [US1] Create tests for generic orchestrator (scoring with weighted penalties, fix loop iteration, degradation guard, commit/push) in `tests/unit/scripts/run-health-tests.test.ts`

### Implementation for User Story 1

- [x] T015 [US1] Create generic test runner script at `.claude-plugin/scripts/bash/run-tests-with-reports.sh` — accept `<config_yml_path> <target_dir>`, read `testing.framework` and `commands.test*` with yq, implement framework-specific JSON reporter flag injection per contract `contracts/config-yml-testing.md`
- [x] T016 [US1] Implement all framework-specific parsers in `.claude-plugin/scripts/bash/run-tests-with-reports.sh` — `parse_vitest_report()`, `parse_playwright_report()`, `parse_pytest_report()`, `parse_cargo_report()`, `parse_go_report()`, `parse_rspec_report()`, `parse_exitcode_report()` per contract `contracts/test-report-parsers.md`
- [x] T017 [US1] Implement server startup logic in `.claude-plugin/scripts/bash/run-tests-with-reports.sh` — read `commands.dev_server` and `.env` section from config.yml, export env vars, start server, wait for `BASE_URL` with timeout
- [x] T018 [US1] Implement summary JSON output in `.claude-plugin/scripts/bash/run-tests-with-reports.sh` — write `/tmp/test-report-summary.json` with standard schema (totalPassed, totalFailed, unit/integration/e2e sections), always exit 0 per existing pattern
- [x] T019 [US1] Create generic test orchestrator at `.claude-plugin/scripts/bash/run-health-tests.sh` — accept `<agent_type> <config_yml_path> <target_dir>`, read config.yml for test commands, call generic runner from T015
- [x] T020 [US1] Implement scoring logic in `.claude-plugin/scripts/bash/run-health-tests.sh` — granular mode uses existing weighted penalties (-1/-3/-5 for unit/integration/e2e), single-command mode uses flat -2 per failure, floor at 0
- [x] T021 [US1] Implement fix loop in `.claude-plugin/scripts/bash/run-health-tests.sh` — max 3 iterations, LLM fix agent via `run-agent.sh`, degradation guard with `git checkout . && git clean -fd`, array merging for autoFixed, last iteration nonFixable only
- [x] T022 [US1] Write `/tmp/test-framework.txt` from orchestrator `.claude-plugin/scripts/bash/run-health-tests.sh` so fix agent knows which report format to expect
- [x] T023 [US1] Update fix agent command `.claude-plugin/commands/ai-board.health-tests-fix.md` — read `/tmp/test-framework.txt` to determine report format, parse vitest/jest JSON or framework-agnostic `/tmp/test-report-summary.json` for other frameworks
- [x] T024 [US1] Update `.github/workflows/health-scan.yml` TESTS scan step (line 338) — change path from `./scripts/run-health-tests.sh` to `./ai-board/.claude-plugin/scripts/bash/run-health-tests.sh "$INPUT_AGENT" target/.ai-board/config.yml target`
- [x] T025 [US1] Update `.github/workflows/health-scan.yml` Playwright install condition (lines 314-325) — read `testing.e2e` from target config.yml, only install browsers if `testing.e2e: true` AND framework is `playwright`
- [x] T026 [US1] Update `.github/workflows/health-scan.yml` sparse checkout (lines 165-171) — ensure `.claude-plugin/scripts/` is included in sparse checkout paths

**Checkpoint**: TESTS scan runs on any project with `commands.test` in config.yml, produces correct scores and reports.

---

## Phase 4: User Story 3 — Graceful Handling When No Tests Configured (Priority: P2)

**Goal**: Projects without test commands get a SKIPPED result with a clear reason instead of a failure.

**Independent Test**: Trigger a TESTS scan on a project with no `commands.test` in config.yml and verify SKIPPED status with descriptive reason.

### Tests for User Story 3
**NOTE: Extend orchestrator tests created in T014.**

- [x] T027 [US3] Extend orchestrator tests in `tests/unit/scripts/run-health-tests.test.sh` with SKIPPED scenarios — no `commands.test`, no `commands` section, missing config.yml

### Implementation for User Story 3

- [x] T028 [US3] Implement SKIPPED detection in `.claude-plugin/scripts/bash/run-health-tests.sh` — if no `commands.test` AND no `commands.test_unit` in config.yml, write SKIPPED result JSON (`score: 0, skipped: true, skipReason`) and exit per schema in `data-model.md`
- [x] T029 [US3] Remove SKIPPED override guard in `.github/workflows/health-scan.yml` (lines 347-349) — allow TESTS scans to return `skipped=true` when no test command is configured
- [x] T030 [US3] Handle test command execution failure gracefully in `.claude-plugin/scripts/bash/run-health-tests.sh` — if command fails to execute (e.g., dependencies not installed), report error in result JSON without crashing workflow

**Checkpoint**: Projects without tests get SKIPPED, projects with broken test commands get error details — neither crashes the workflow.

---

## Phase 5: User Story 4 — Existing ai-board TESTS Scan Preserved (Priority: P2)

**Goal**: ai-board's own TESTS scan (vitest + Playwright, fix loop, scoring) works identically after migration to plugin scripts.

**Independent Test**: Run TESTS health scan on ai-board and verify same scoring, fix behavior, and report schema as pre-migration.

### Tests for User Story 4
**NOTE: No existing test files cover this regression path. New test file created.**

- [x] T031 [US4] Create regression test verifying ai-board config produces correct runner invocations in `tests/unit/scripts/aiboard-regression.test.sh` — validate vitest JSON parser, Playwright parser, granular mode (unit/integration/e2e), server startup, weighted scoring

### Implementation for User Story 4

- [x] T032 [US4] Update `.ai-board/config.yml` — add `testing:` section (`framework: vitest`, `e2e: true`, `e2e_framework: playwright`), add `commands.test: "bun run test"`, add `commands.dev_server: "TEST_MODE=true bun run dev"`
- [x] T033 [US4] Verify ai-board's granular commands (`test_unit`, `test_integration`, `test_e2e`) in `.ai-board/config.yml` take priority over `commands.test` per resolution rules in `contracts/config-yml-testing.md`

**Checkpoint**: ai-board TESTS scan produces identical scores and behavior to pre-migration.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation consistency, and final validation.

- [x] T034 Add inline documentation to `.claude-plugin/scripts/bash/run-tests-with-reports.sh` explaining supported frameworks and parser selection logic
- [x] T035 Add inline documentation to `.claude-plugin/scripts/bash/run-health-tests.sh` explaining SKIPPED, scoring modes, and fix loop
- [x] T036 Verify all other health scan types (SECURITY, COMPLIANCE, SPEC_SYNC, REVIEW_QUALITY) are unaffected by workflow changes in `.github/workflows/health-scan.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — review tasks, can start immediately
- **US2 (Phase 2)**: Can start immediately after Setup — independent of US1
- **US1 (Phase 3)**: Can start immediately after Setup — independent of US2
  - Within US1: T015-T018 (runner) → T019-T022 (orchestrator) → T023 (fix agent) → T024-T026 (workflow)
- **US3 (Phase 4)**: Depends on US1 orchestrator (T019) being complete
- **US4 (Phase 5)**: Depends on US1 runner + orchestrator being complete
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US2 (P1)**: No dependencies on other stories — stack detection is independent
- **US1 (P1)**: No dependencies on other stories — can use manually written config.yml for testing
- **US3 (P2)**: Depends on US1's orchestrator script existing (T019)
- **US4 (P2)**: Depends on US1's runner + orchestrator being functional (T015-T022)

### Within Each User Story

- Tests written first (fail before implementation)
- Infrastructure scripts before orchestration scripts
- Runner (T015-T018) before orchestrator (T019-T022)
- Orchestrator before workflow updates (T024-T026)
- Core implementation before polish

### Parallel Opportunities

- **US1 and US2** can execute entirely in parallel (different files, no dependencies)
- **Within US1**: T012, T013, T014 (all tests) can run in parallel
- **Within US1**: T015, T016, T017, T018 (runner parts) are sequential (same file)
- **Within US2**: T004, T005, T006 (all tests) can run in parallel
- **Within US2**: T007, T008, T009 can be parallel (different functions), T010-T011 depend on them
- **US3 and US4** can execute in parallel once US1 orchestrator is done

---

## Parallel Example: User Story 1 + User Story 2

```bash
# Launch US1 and US2 test tasks in parallel (different files):
Task T004: "Create test command detection tests in tests/unit/scripts/detect-stack-test-commands.test.sh"
Task T005: "Create E2E detection tests in tests/unit/scripts/detect-stack-e2e.test.sh"
Task T012: "Create parser tests in tests/unit/scripts/test-report-parsers.test.sh"
Task T013: "Create runner tests in tests/unit/scripts/run-tests-with-reports.test.sh"

# After tests, launch US1 runner and US2 detection in parallel:
Task T007: "Add detect_test_commands() to .github/scripts/detect-stack.sh"
Task T015: "Create generic test runner at .claude-plugin/scripts/bash/run-tests-with-reports.sh"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (review existing scripts)
2. Complete Phase 2: US2 — Stack Detection (parallel with US1)
3. Complete Phase 3: US1 — Generic TESTS Scan (runner → orchestrator → workflow)
4. **STOP and VALIDATE**: Test TESTS scan on ai-board and a mock external project
5. Deploy if ready — external projects can now run TESTS scans

### Incremental Delivery

1. US2 (Stack Detection) → config.yml now includes test info for new projects
2. US1 (Generic Runner) → TESTS scan works on any configured project (MVP!)
3. US3 (SKIPPED) → Projects without tests handled gracefully
4. US4 (Backward Compat) → ai-board's own scan verified identical
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup phase sequentially (quick review)
2. Launch US1 and US2 in parallel (independent files)
3. Once US1 orchestrator done, launch US3 and US4 in parallel
4. Polish phase last

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All new scripts in `.claude-plugin/scripts/bash/` — the plugin checkout path
- Old scripts in `scripts/` kept for backward compatibility during transition
- Shell script tests are new — no existing test files to extend for this domain
- Always exit 0 pattern must be preserved in the generic runner
- Degradation guard pattern must be preserved in the generic orchestrator
