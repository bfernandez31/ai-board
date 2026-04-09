# Feature Specification: Generic Health Tests — Make TESTS Scan Work on Any Project

**Feature Branch**: `AIB-586-generic-health-tests`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Generic health tests: make TESTS scan work on any project"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether the generic test runner should also abstract `run-tests-with-reports.sh` or only `run-health-tests.sh`
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score: 5) — internal tooling, no compliance implications
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Moving both scripts to the plugin makes the system fully self-contained for any project, but increases scope
  2. Only moving the orchestrator and adapting it to call framework-specific commands keeps scope tighter
- **Reviewer Notes**: Both scripts must move to the plugin. The test execution script (`run-tests-with-reports.sh`) is ai-board-specific (hardcodes vitest, Playwright, bun). The generic version must read test commands and framework from `config.yml` to produce reports for any stack.

---

- **Decision**: How to handle projects with partial test infrastructure (e.g., unit tests but no E2E)
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score: 5)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requiring all test types would fail on most external projects
  2. Running only configured test types is flexible but changes scoring baseline
- **Reviewer Notes**: The system should run only the test types available (based on config.yml entries). Missing test types are reported as "not configured" (not as failures). Scoring applies only to tests that actually ran.

---

- **Decision**: Whether `commands.type-check` and `commands.lint` should be used by the TESTS health scan or only stored for future scans
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score: 4)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Including type-check/lint in TESTS scan broadens scope beyond tests
  2. Only detecting and storing them keeps TESTS scan focused while enabling future use
- **Reviewer Notes**: Detect and store `commands.type-check` and `commands.lint` in config.yml during stack detection, but do not use them in the TESTS scan. They are groundwork for future LINT/TYPE_CHECK scan types.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - TESTS Scan on External Project (Priority: P1)

A project owner triggers a TESTS health scan on an external project that has its own test suite (e.g., a Node.js project using Jest). The system detects the project's test command from `config.yml`, runs the tests, scores the results, and reports findings — without requiring any custom scripts in the target repository.

**Why this priority**: This is the core value proposition — making TESTS scans work on any project, not just ai-board.

**Independent Test**: Can be tested by running a TESTS health scan against any repository that has `commands.test` configured in its `.ai-board/config.yml` and verifying results are produced.

**Acceptance Scenarios**:

1. **Given** an external project with `commands.test: "npm test"` in config.yml, **When** a TESTS health scan is triggered, **Then** the system runs `npm test`, parses results, computes a score, and produces a valid health scan result.
2. **Given** an external project with vitest as the test framework, **When** the scan runs, **Then** JSON reports are parsed using vitest format and individual test pass/fail counts are accurate.
3. **Given** an external project with pytest, **When** the scan runs, **Then** the system adapts result parsing to pytest output format.

---

### User Story 2 - Stack Detection Generates Test Configuration (Priority: P1)

During project onboarding, the stack detection process identifies the project's test command, test framework, and E2E testing presence, and writes these to `config.yml` so that TESTS scans can run without manual configuration.

**Why this priority**: Without auto-detected test configuration, project owners would need to manually configure `commands.test` — defeating the goal of zero-config health scans.

**Independent Test**: Can be tested by running `detect-stack.sh` on repositories with various tech stacks and verifying the generated config.yml contains correct test-related fields.

**Acceptance Scenarios**:

1. **Given** a Node.js project with `"test": "vitest run"` in package.json scripts, **When** stack detection runs, **Then** config.yml contains `commands.test` with the appropriate package-manager-prefixed command and `testing.framework: vitest`.
2. **Given** a Python project with pytest installed, **When** stack detection runs, **Then** config.yml contains `commands.test: "pytest"` and `testing.framework: pytest`.
3. **Given** a Rust project, **When** stack detection runs, **Then** config.yml contains `commands.test: "cargo test"` and `testing.framework: cargo-test`.
4. **Given** a project with Playwright in devDependencies, **When** stack detection runs, **Then** config.yml contains `testing.e2e: true`.
5. **Given** a project with a TypeScript compiler configured, **When** stack detection runs, **Then** config.yml contains `commands.type_check` with the appropriate command.

---

### User Story 3 - Graceful Handling When No Tests Configured (Priority: P2)

A project has been onboarded but has no test suite. When a TESTS health scan is triggered, the system reports SKIPPED with a clear reason rather than failing.

**Why this priority**: Prevents confusing failures for projects without tests, providing a clear signal to project owners.

**Independent Test**: Can be tested by triggering a TESTS scan on a project with no `commands.test` in config.yml and verifying SKIPPED status with a descriptive reason.

**Acceptance Scenarios**:

1. **Given** a project with no `commands.test` in config.yml, **When** a TESTS scan is triggered, **Then** the result has score 0, status SKIPPED, and a report message explaining that no test command is configured.
2. **Given** a project with `commands.test` set but the command fails to execute (e.g., dependencies not installed), **When** a TESTS scan is triggered, **Then** the result reports the error clearly without crashing the workflow.

---

### User Story 4 - Existing ai-board TESTS Scan Preserved (Priority: P2)

The ai-board project's existing TESTS scan behavior (unit + integration + E2E with vitest and Playwright, fix loop, scoring) continues to work identically after the migration to the plugin-based script.

**Why this priority**: Regression prevention — the current working behavior must not break.

**Independent Test**: Can be tested by running a TESTS health scan on ai-board and comparing results with the pre-migration behavior.

**Acceptance Scenarios**:

1. **Given** the ai-board project with its full test suite, **When** a TESTS scan runs using the new plugin script, **Then** unit, integration, and E2E tests all execute and produce the same scoring as the old script.
2. **Given** failing tests in ai-board, **When** the fix loop runs, **Then** the LLM fix agent is invoked, tests are re-run, and degradation guards work as before.

---

### Edge Cases

- What happens when `config.yml` exists but has no `commands` section? Treated as no test command configured; scan returns SKIPPED.
- What happens when the test command exits with a non-zero code but produces valid output? Results are parsed from output; non-zero exit alone does not indicate scan failure (many test runners exit non-zero on test failures).
- What happens when a project has multiple test commands (e.g., separate unit and E2E)? The system supports `commands.test_unit`, `commands.test_integration`, and `commands.test_e2e` for granular control. If only `commands.test` is set, it runs as the sole test command.
- What happens when the test framework in config.yml doesn't match the actual output format? Parser falls back to line-based pass/fail counting with a warning in the report.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read the test command from `config.yml` (`commands.test` or granular `commands.test_unit`/`commands.test_integration`/`commands.test_e2e`) instead of hardcoding any specific test runner.
- **FR-002**: System MUST read the test framework from `config.yml` (`testing.framework`) to determine the appropriate result parsing strategy (vitest JSON, jest JSON, pytest, cargo test, go test, etc.).
- **FR-003**: System MUST report SKIPPED with a descriptive reason when no test command is configured in `config.yml`.
- **FR-004**: System MUST preserve the existing fix loop behavior: run tests, if failures invoke LLM fix agent, re-run, loop (max 3 iterations) with degradation guard.
- **FR-005**: System MUST support result parsing for at least: vitest (JSON), jest (JSON), pytest (text/JUnit XML), cargo test (text), and go test (text/JSON).
- **FR-006**: Stack detection MUST generate `commands.test` in `config.yml` based on detected package manager and test scripts/conventions.
- **FR-007**: Stack detection MUST generate `testing.framework` in `config.yml` with the detected test framework identifier.
- **FR-008**: Stack detection MUST generate `testing.e2e` (boolean) in `config.yml` indicating whether an E2E testing framework (Playwright, Cypress, Selenium) is detected.
- **FR-009**: Stack detection MUST generate `commands.type_check` and `commands.lint` in `config.yml` when applicable tooling is detected.
- **FR-010**: The health scan workflow MUST invoke the test orchestrator from the ai-board plugin checkout path, not from the target repository.
- **FR-011**: System MUST compute scores based only on test types that actually ran; missing/unconfigured test types MUST NOT count as failures.

### Key Entities

- **config.yml (`testing` section)**: New section added to the project configuration file containing `framework` (string: vitest, jest, pytest, cargo-test, go-test, rspec, phpunit) and `e2e` (boolean indicating E2E framework presence).
- **config.yml (`commands` extensions)**: Existing `commands` section gains `test` (primary test command), `test_unit`/`test_integration`/`test_e2e` (optional granular commands), `type_check`, and `lint` fields.
- **Health Scan Result**: JSON output at `/tmp/health-scan-result.json` with score, issues found/fixed, and typed report — schema unchanged from current implementation.

### Internal Processes

- **Stack Detection (detect-stack.sh)**: Runs during project onboarding to analyze repository structure.
  - **Input**: Path to target repository root
  - **Phases**:
    1. Detect language, framework, package manager (existing)
    2. Detect test framework from dependencies and config files (existing, currently only stored in analysis.json)
    3. Detect test command from package.json scripts, Makefile targets, or language conventions (new)
    4. Detect type-check and lint commands from scripts/dependencies (new)
    5. Detect E2E framework presence (new)
    6. Write `testing` and extended `commands` sections to config.yml (new)
  - **Output**: Updated `config.yml` with `commands.test`, `commands.type_check`, `commands.lint`, `testing.framework`, `testing.e2e`; updated `analysis.json`
  - **Error behavior**: Missing fields are omitted from config.yml (not set to null or empty). Detection failures for optional fields do not block onboarding.

- **Generic Test Orchestrator (run-health-tests.sh in plugin)**: Executes during TESTS health scan.
  - **Input**: Agent type (CLAUDE/CODEX), path to target repo, config.yml location
  - **Phases**:
    1. Read `config.yml` for test commands and framework
    2. If no test command found, write SKIPPED result and exit
    3. Execute test command(s) and capture output
    4. Parse results using framework-appropriate parser
    5. Compute regression-penalty score from parsed results
    6. If failures exist, enter fix loop (max 3 iterations with LLM agent)
    7. Write final result JSON
  - **Output**: `/tmp/health-scan-result.json` with standardized schema
  - **Error behavior**: Test command execution failure produces a result with score 0 and error details; does not crash the workflow. Degradation guard reverts changes if fix iteration increases failure count.

- **Generic Test Runner (run-tests-with-reports.sh in plugin)**: Executes individual test commands and produces JSON reports.
  - **Input**: Config.yml with test commands and framework identifiers
  - **Phases**:
    1. Read configured test commands (granular or single)
    2. For each configured test type, run the command with appropriate JSON reporter flags
    3. Parse output using framework-specific parser
    4. Start dev server if integration/E2E tests require it (based on config)
    5. Write per-type reports and summary JSON
  - **Output**: `/tmp/test-report-summary.json` and per-type report files
  - **Error behavior**: Never exits non-zero. Captures all errors in summary JSON for orchestrator consumption.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: TESTS health scans complete successfully on projects using at least 5 different test frameworks (vitest, jest, pytest, cargo test, go test) without requiring any custom scripts in the target repository.
- **SC-002**: Stack detection correctly identifies and configures test commands for 100% of supported language/framework combinations (Node.js, Python, Rust, Go, Ruby, PHP).
- **SC-003**: Projects without test suites receive a SKIPPED result within 10 seconds (no wasted computation).
- **SC-004**: Existing ai-board TESTS health scan produces identical scores and fix behavior after migration (zero regression in test detection, scoring, or fix loop).
- **SC-005**: Zero manual configuration required for projects whose test setup follows standard conventions (package.json scripts, Makefile targets, or language defaults).
