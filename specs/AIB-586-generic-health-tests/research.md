# Research: Generic Health Tests — AIB-586

## Existing Files

### Scripts (to be modified or replaced)

| Path | Purpose | Action |
|------|---------|--------|
| `scripts/run-health-tests.sh` | TESTS scan orchestrator — runs tests, scores, fix loop, writes result | **Move to `.claude-plugin/scripts/bash/run-health-tests.sh`** and genericize |
| `scripts/run-tests-with-reports.sh` | Runs unit/integration/E2E with vitest/Playwright, writes JSON reports | **Move to `.claude-plugin/scripts/bash/run-tests-with-reports.sh`** and genericize |
| `.github/scripts/detect-stack.sh` | Stack detection during onboarding — detects language, framework, test framework | **Extend** — add `testing` section and `commands.test/type_check/lint` to config.yml output |
| `.github/scripts/run-command.sh` | Config-driven command executor — reads config.yml, runs by key | **Extend** — add `test` as a command key (generic single test command) |
| `.github/scripts/setup-environment.sh` | Environment setup for workflows | No changes needed |

### Workflow Files

| Path | Purpose | Action |
|------|---------|--------|
| `.github/workflows/health-scan.yml` (lines 327-384) | TESTS scan execution — calls `./scripts/run-health-tests.sh` | **Modify** — change path to `.claude-plugin/scripts/bash/run-health-tests.sh`, pass config path |
| `.github/workflows/health-scan.yml` (lines 285-325) | Playwright setup | **Modify** — conditional on `testing.e2e` in config.yml instead of hardcoded |

### Plugin Commands

| Path | Purpose | Action |
|------|---------|--------|
| `.claude-plugin/commands/ai-board.health-tests-fix.md` | LLM fix agent for failing tests | **Modify** — accept framework-specific report format info |

### Config Files

| Path | Purpose | Action |
|------|---------|--------|
| `.ai-board/config.yml` | ai-board's own config | **Update** — add `testing` section as reference example |

### Type Definitions

| Path | Purpose | Action |
|------|---------|--------|
| `lib/health/types.ts` | Health scan TypeScript types | No changes needed — `TestsReport` schema unchanged |
| `lib/health/scan-commands.ts` | Static scan command mapping | No changes needed |
| `lib/health/scan-dispatch.ts` | Workflow dispatch logic | No changes needed |

### Test Files

| Path | Purpose | Action |
|------|---------|--------|
| No existing test files for health scripts | Shell scripts untested | Consider adding basic shell script tests if scope allows |

## Patterns to Follow

### Error Handling Pattern (run-health-tests.sh:177-188)
- **Degradation guard**: If fix iteration increases failure count, revert ALL changes with `git checkout . && git clean -fd`
- **Fix accumulation reset**: `ALL_AUTO_FIXED="[]"` on revert
- New generic orchestrator MUST preserve this exact pattern

### Report Output Pattern (run-tests-with-reports.sh:199-227)
- Summary JSON always written regardless of success/failure
- Individual report files initialized to `{}` at start (line 28-30)
- Script always exits 0 — consumer reads summary.json
- New generic runner MUST follow this "never exit non-zero" pattern

### Config Lookup Pattern (run-command.sh:85-92)
- Read config.yml with yq, fall back to default if key not found
- Silent skip (exit 0) if no config and no default
- New scripts MUST use the same config lookup approach

### Scoring Pattern (run-health-tests.sh:46-59)
- Regression-penalty model: 100 minus weighted penalties
- Weights: unit=-1, integration=-3, e2e=-5
- Floor at 0 with `[0, score] | max`
- For generic projects with only a single `test` command: all failures count as integration-weight (-3) since we can't distinguish type

### Fix Loop Pattern (run-health-tests.sh:132-192)
- Max 3 iterations (configurable via MAX_ITERATIONS)
- LLM called with `ai-board.health-tests-fix` command
- Results merged via `merge_arrays()` (jq -s '.[0] + .[1]')
- Only last iteration's `nonFixable` kept
- Commit & push only if fixes exist AND files changed

### Stack Detection Pattern (detect-stack.sh:342-415)
- Language-specific switch/case for test framework detection
- Check dependencies first (package.json, pyproject.toml, Gemfile, composer.json)
- Then check config files (vitest.config.ts, jest.config.js)
- Store in `TEST_FRAMEWORK` variable → written to `analysis.json`

## Decisions

### Decision 1: How to determine test command for generic projects

- **Decision**: Read `commands.test` from config.yml as the primary test command. If granular commands (`test_unit`, `test_integration`, `test_e2e`) are present, use those instead. Stack detection infers the command from package.json scripts, Makefile targets, or language conventions.
- **Rationale**: This follows the existing config.yml pattern where commands are stored by key. The `run-command.sh` script already supports this lookup pattern.
- **Alternatives considered**: (1) Always require manual config — rejected, defeats zero-config goal. (2) Run framework CLI directly (e.g., `pytest`) — rejected, package manager prefix needed.

### Decision 2: How to parse test results for unknown frameworks

- **Decision**: Support 5 framework-specific parsers (vitest, jest, pytest, cargo-test, go-test) based on `testing.framework` config. Unknown frameworks fall back to exit-code-based counting (0 failures if exit 0, 1 failure if exit non-zero) with a warning.
- **Rationale**: The spec requires at least 5 frameworks (SC-001). Exit-code fallback ensures any project can get basic scoring.
- **Alternatives considered**: (1) JUnit XML universal format — rejected, not all runners produce it without plugins. (2) Regex-based line parsing — rejected, too fragile across versions.

### Decision 3: How to handle server startup for integration/E2E tests

- **Decision**: Server startup is controlled by config.yml `commands.dev_server` key. If present, the runner starts it before integration/E2E tests. If absent, tests run without a server (assumed self-contained or using test fixtures).
- **Rationale**: ai-board's current runner hardcodes server startup with test-specific env vars. Making it config-driven allows any project to define its own server command, or skip it entirely.
- **Alternatives considered**: (1) Auto-detect server need from framework — rejected, unreliable. (2) Always skip — rejected, breaks integration tests for web apps.

### Decision 4: Where to place generic scripts

- **Decision**: Both scripts move to `.claude-plugin/scripts/bash/` (alongside existing plugin scripts). The workflow sparse-checks `.claude-plugin` already (health-scan.yml line 165-171).
- **Rationale**: The plugin checkout is the mechanism for making ai-board tooling available to external projects. Scripts in `scripts/` are only available to ai-board itself.
- **Alternatives considered**: (1) Keep in `scripts/` and symlink — rejected, symlinks don't work across repo checkouts. (2) Copy to `.github/scripts/` — rejected, that's for workflow helpers, not scan executors.

### Decision 5: How to handle the `testing.e2e` flag in config.yml

- **Decision**: Stack detection writes `testing.e2e: true` when Playwright, Cypress, or Selenium is detected. The health-scan workflow uses this to conditionally install Playwright browsers (currently hardcoded to always install for TESTS scans).
- **Rationale**: External projects may not use Playwright. Installing browsers when not needed wastes 30+ seconds.
- **Alternatives considered**: Always install — rejected, wastes CI time for non-browser projects.
