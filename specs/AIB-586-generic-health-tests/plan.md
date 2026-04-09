# Implementation Plan: Generic Health Tests — AIB-586

**Branch**: `AIB-586-generic-health-tests`
**Status**: Ready for Implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| **Language** | Bash (shell scripts), YAML (workflow), TypeScript (config types if needed) |
| **Frameworks** | GitHub Actions, yq/jq for YAML/JSON processing |
| **Dependencies** | yq, jq, curl — all available in CI runners |
| **Integration Points** | `health-scan.yml` workflow, `detect-stack.sh`, `run-command.sh`, `config.yml` |
| **Unknowns** | None — all resolved in research.md |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | N/A | Changes are shell scripts and YAML, no TS code modified |
| II. Component-Driven | N/A | No UI changes |
| III. Test-Driven | PASS | Existing test behavior preserved (US4). New behavior testable via shell script invocation |
| IV. Security-First | PASS | No secrets exposed; env vars read from config.yml (same as current). No raw SQL. Fix agent model read from env var |
| V. Database Integrity | N/A | No schema changes |
| V. Spec Clarification | PASS | Auto-resolved decisions documented in spec.md with trade-offs |

## Implementation Phases

### Phase 1: Extend Stack Detection (detect-stack.sh)

**Goal**: Stack detection produces `testing` section and extended `commands` in config.yml.

**Files**:
- **Modify**: `.github/scripts/detect-stack.sh` (lines 593-648: `generate_config_yml()`)

**Changes**:
1. Add `detect_test_commands()` function after `detect_commands()` (line 532):
   - For JS/TS: Check `package.json` scripts for `test`, `test:unit`, `test:integration`, `test:e2e`, `type-check`/`typecheck`, `lint`
   - Prefix with detected package manager (`bun run test`, `npm test`, etc.)
   - For Python: `pytest` if pytest detected; `python -m unittest` fallback
   - For Rust: `cargo test`
   - For Go: `go test ./...`
   - For Ruby: `bundle exec rspec` if rspec; `bundle exec rake test` fallback
   - For PHP: `./vendor/bin/phpunit` if phpunit detected
   - For Java: `mvn test` or `gradle test`

2. Add `detect_e2e_framework()` function:
   - Check for `@playwright/test`, `cypress`, `selenium-webdriver` in deps
   - Set `E2E_DETECTED=true` and `E2E_FRAMEWORK=playwright|cypress|selenium`

3. Add `detect_lint_typecheck()` function:
   - JS/TS: Check for `lint`, `type-check`/`typecheck` in package.json scripts
   - Python: Check for `ruff`, `flake8`, `mypy`, `pyright` in deps
   - Rust: `cargo clippy` (lint), built-in type checking via `cargo check`
   - Go: `go vet` (lint)

4. Update `generate_config_yml()` to emit new sections:
   ```yaml
   testing:
     framework: ${TEST_FRAMEWORK}
     e2e: ${E2E_DETECTED}
   commands:
     test: "${TEST_CMD}"
     type_check: "${TYPE_CHECK_CMD}"
     lint: "${LINT_CMD}"
   ```

5. Update `generate_analysis_json()` to include new detection results.

**FR coverage**: FR-006, FR-007, FR-008, FR-009

### Phase 2: Create Generic Test Runner (plugin script)

**Goal**: Replace hardcoded vitest/Playwright runner with config-driven generic runner.

**Files**:
- **Create**: `.claude-plugin/scripts/bash/run-tests-with-reports.sh`
- **Keep**: `scripts/run-tests-with-reports.sh` (unchanged, for backward compat during transition)

**Changes**:
1. Accept arguments: `<config_yml_path> <target_dir>`
2. Read config with yq:
   - `testing.framework` → select parser
   - `commands.test_unit` / `test_integration` / `test_e2e` → granular mode
   - `commands.test` → single-command mode
   - `commands.dev_server` → server startup (optional)
3. Implement framework-specific JSON reporter flags:
   - vitest/jest: `--reporter=json --outputFile=<path>`
   - pytest: `--tb=short -q` (capture stdout) + optional `--junitxml=<path>`
   - cargo-test: capture stdout
   - go-test: `-json` flag, redirect to file
   - rspec: `--format json --out <path>`
   - phpunit: `--log-junit <path>`
4. Implement framework-specific parsers (see `contracts/test-report-parsers.md`):
   - `parse_vitest_report()` — reuse from current script
   - `parse_playwright_report()` — reuse from current script
   - `parse_pytest_report()` — new, regex-based
   - `parse_cargo_report()` — new, regex-based
   - `parse_go_report()` — new, grep JSON lines
   - `parse_rspec_report()` — new, jq-based
   - `parse_exitcode_report()` — new, exit-code fallback
5. Server startup logic (if `commands.dev_server` configured):
   - Read env vars from `config.yml` `.env` section
   - Export them and start server
   - Wait for `BASE_URL` (default `http://localhost:3000`) with timeout
6. Write same summary JSON schema as current script (`/tmp/test-report-summary.json`)
7. Always exit 0 — following existing pattern (run-tests-with-reports.sh:234)

**FR coverage**: FR-001, FR-002, FR-005, FR-011

### Phase 3: Create Generic Test Orchestrator (plugin script)

**Goal**: Replace hardcoded orchestrator with config-aware version that supports SKIPPED.

**Files**:
- **Create**: `.claude-plugin/scripts/bash/run-health-tests.sh`
- **Keep**: `scripts/run-health-tests.sh` (unchanged, for backward compat during transition)

**Changes**:
1. Accept arguments: `<agent_type> <config_yml_path> <target_dir>`
2. Read config.yml to check for test commands:
   - If no `commands.test` AND no `commands.test_unit` → write SKIPPED result and exit
3. Call the generic test runner from Phase 2 (not the old hardcoded one)
4. Scoring:
   - If granular mode (unit/integration/e2e): use existing weighted penalties (-1/-3/-5)
   - If single-command mode: use flat -2 per failure (middle weight)
   - Floor at 0
5. Fix loop: Preserve exact existing behavior:
   - Max 3 iterations
   - LLM fix agent via `run-agent.sh`
   - Degradation guard with `git checkout . && git clean -fd`
   - Array merging for autoFixed
   - Only last iteration's nonFixable kept
6. Commit & push pattern: Preserve existing behavior
7. Write `/tmp/health-scan-result.json` with standard schema

**FR coverage**: FR-003, FR-004, FR-010

### Phase 4: Update Health Scan Workflow

**Goal**: Workflow calls plugin scripts instead of local scripts.

**Files**:
- **Modify**: `.github/workflows/health-scan.yml`

**Changes**:
1. Update TESTS scan execution step (line 338):
   ```bash
   # Old: ./scripts/run-health-tests.sh "$INPUT_AGENT"
   # New: ./ai-board/.claude-plugin/scripts/bash/run-health-tests.sh "$INPUT_AGENT" target/.ai-board/config.yml target
   ```
   The `ai-board/` prefix is the sparse checkout path for the ai-board repo in CI.

2. Update Playwright install condition (lines 314-325):
   - Read `testing.e2e` from target's config.yml
   - Only install Playwright browsers if `testing.e2e: true` AND framework is `playwright`

3. Remove the SKIPPED override guard (lines 347-349):
   - Currently forces `skipped=false` for TESTS scans
   - With generic support, TESTS scans CAN be SKIPPED (no test command configured)

4. Update sparse checkout to include `.claude-plugin/scripts/` if not already included.

**FR coverage**: FR-010

### Phase 5: Update ai-board's Own Config

**Goal**: ai-board's config.yml gets the new `testing` section, serving as reference.

**Files**:
- **Modify**: `.ai-board/config.yml`

**Changes**:
1. Add `testing` section:
   ```yaml
   testing:
     framework: vitest
     e2e: true
     e2e_framework: playwright
   ```
2. Add `commands.test` (generic fallback):
   ```yaml
   commands:
     test: "bun run test"
   ```
3. Add `commands.dev_server`:
   ```yaml
   commands:
     dev_server: "TEST_MODE=true bun run dev"
   ```

**FR coverage**: Ensures ai-board itself works with the new generic system

### Phase 6: Update Fix Agent Command

**Goal**: Fix agent accepts framework info so it can parse the right report format.

**Files**:
- **Modify**: `.claude-plugin/commands/ai-board.health-tests-fix.md`

**Changes**:
1. Add input parameter for test framework:
   - Read `/tmp/test-framework.txt` (written by orchestrator) to know which report format to expect
2. Update report file references to be framework-aware:
   - If vitest/jest: parse `.testResults[].assertionResults[]`
   - If other: parse from `/tmp/test-report-summary.json` (framework-agnostic summary)
3. Keep existing fix scope rules (mechanical fixes only, no architectural changes)

## Testing Strategy

### Existing Tests to Extend
No existing test files cover health scan shell scripts. The scripts are currently tested only via manual workflow runs.

### New Tests

1. **detect-stack.sh integration tests** (optional, if time allows):
   - Create mock project directories with different stacks
   - Run detect-stack.sh and verify config.yml output
   - Verify `testing.framework`, `testing.e2e`, `commands.test` populated correctly

2. **Manual verification** (required):
   - Run TESTS health scan on ai-board → verify identical behavior to pre-migration
   - Trigger detect-stack.sh on a mock Python project → verify pytest config generated
   - Trigger TESTS scan on a project with no test command → verify SKIPPED result

### Regression Verification
- ai-board's TESTS scan must produce the same score, fix behavior, and report schema
- All existing health scan types (SECURITY, COMPLIANCE, SPEC_SYNC, REVIEW_QUALITY) must be unaffected

## Dependency Order

```
Phase 1 (detect-stack.sh) → can start immediately
Phase 2 (generic runner)  → can start immediately (independent of Phase 1)
Phase 3 (generic orchestrator) → depends on Phase 2
Phase 4 (workflow update) → depends on Phase 3
Phase 5 (ai-board config) → can start immediately (independent)
Phase 6 (fix agent update) → depends on Phase 3
```

**Parallelizable**: Phases 1, 2, and 5 can be done in parallel. Phases 3, 4, 6 are sequential.

## Generated Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-586-generic-health-tests/research.md` |
| Data Model | `specs/AIB-586-generic-health-tests/data-model.md` |
| Config Contract | `specs/AIB-586-generic-health-tests/contracts/config-yml-testing.md` |
| Parser Contract | `specs/AIB-586-generic-health-tests/contracts/test-report-parsers.md` |
| This Plan | `specs/AIB-586-generic-health-tests/plan.md` |
