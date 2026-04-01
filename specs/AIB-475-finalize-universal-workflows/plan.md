# Implementation Plan: Finalize Universal Workflows

**Feature Branch**: `AIB-475-finalize-universal-workflows`
**Date**: 2026-04-01
**Status**: Ready for implementation

---

## Technical Context

| Aspect | Value |
|--------|-------|
| Language | Bash (scripts), YAML (workflows) |
| Framework | GitHub Actions |
| Dependencies | yq v4.44.1, bash 4+ (associative arrays) |
| Database changes | None |
| API changes | None |
| New files | `.github/scripts/run-command.sh` |
| Modified files | `setup-environment.sh`, 6 workflow YAML files |

### Unknowns Resolved

All NEEDS CLARIFICATION items resolved in `research.md`:
- ✅ GitHub Actions conditional service containers — expression-based image strings
- ✅ AIB-468 revert root causes — all three addressed
- ✅ run-command.sh design — fallback table + yq parsing
- ✅ setup-environment.sh mode parameter — lightweight vs full
- ✅ Workflow modification scope — 6 files identified
- ✅ yq availability — self-bootstrapping in run-command.sh
- ✅ Workspace layout — `ai-board/` prefix convention

---

## Constitution Check

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| I. TypeScript-First | N/A | No TypeScript code — bash scripts and YAML only |
| II. Component-Driven Architecture | N/A | No UI components |
| III. Test-Driven Development | ✅ | Unit tests for run-command.sh; integration tests for workflow behavior |
| IV. Security-First | ✅ | No secrets in scripts; yq validates YAML; no raw command injection |
| V. Database Integrity | N/A | No database changes |
| V. Specification Guardrails | ✅ | Auto-resolved decisions documented with conservative fallbacks |

---

## Implementation Tasks

### Task 1: Create `run-command.sh` (Priority: P0)

**File**: `.github/scripts/run-command.sh`

Create the centralized command dispatch script per the contract in `contracts/run-command.md`.

**Requirements covered**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-012, FR-015

**Implementation details**:
1. Accept `<target-dir>` and `<command-key>` arguments
2. Bootstrap `yq` if not on PATH (reuse pattern from setup-environment.sh)
3. Check for `.ai-board/config.yml` in target-dir
4. If missing: use associative array of fallback defaults
5. If present but invalid YAML: exit 2 with error to stderr
6. If present and valid: extract `commands.<key>` via `yq eval`
7. If value is empty or null: exit 0 silently
8. Execute command via `eval` in target-dir, return exit code
9. Make script executable (`chmod +x`)

**Fallback table**:
```bash
declare -A DEFAULTS=(
  [install]="bun install --frozen-lockfile"
  [build]="bun run build"
  [lint]="bun run lint"
  [type_check]="bun run type-check"
  [test_unit]="bun run test:unit"
  [test_integration]="bun run test:integration"
  [test_e2e]="bunx playwright test"
)
```

**Dependencies**: None (first task)

---

### Task 2: Add `--mode` parameter to `setup-environment.sh` (Priority: P0)

**File**: `.github/scripts/setup-environment.sh`

Extend the existing script to accept a `--mode lightweight|full` flag per the contract in `contracts/setup-environment.md`.

**Requirements covered**: FR-009, FR-010, FR-014

**Implementation details**:
1. Parse `--mode` flag from arguments (default: `lightweight`)
2. Wrap dependency installation, Prisma, Playwright, env export, and global-setup steps in a `if [[ "$MODE" == "full" ]]; then` guard
3. Ensure lightweight steps (yq, validation, symlinks, runtimes, git config, agent CLI) always run
4. Preserve execution order: symlinks → runtimes → deps → Prisma → Playwright (FR-010)
5. Handle missing config gracefully in lightweight mode (symlinks and runtimes can use defaults)

**Dependencies**: None (independent of Task 1)

---

### Task 3: Update `speckit.yml` (Priority: P1)

**File**: `.github/workflows/speckit.yml`

**Requirements covered**: FR-006, FR-007, FR-008, FR-009, FR-011, FR-013

**Implementation details**:
1. Add service inputs (`needs_postgres`, `postgres_version`, `needs_redis`, `redis_version`, `needs_mysql`, `mysql_version`, `needs_mongo`, `mongo_version`)
2. Replace static `image: postgres:14` with conditional expression
3. Add Redis, MySQL, MongoDB service definitions (conditional)
4. Replace hardcoded setup steps with:
   - Specify/plan commands: `setup-environment.sh <target> --mode lightweight`
   - Implement command: `setup-environment.sh <target> --mode full`
5. Replace hardcoded `bun install --frozen-lockfile` with `run-command.sh <target> install`
6. Replace hardcoded `bun run test:unit` with `run-command.sh <target> test_unit`
7. Preserve Bun cache step (FR-013)
8. Ensure all script paths use `ai-board/.github/scripts/` prefix (FR-011)

**Dependencies**: Tasks 1, 2

---

### Task 4: Update `quick-impl.yml` (Priority: P1)

**File**: `.github/workflows/quick-impl.yml`

**Requirements covered**: FR-006, FR-007, FR-008, FR-011, FR-013

**Implementation details**:
1. Add service inputs (same as speckit)
2. Replace static PostgreSQL service with conditional expression
3. Add conditional Redis/MySQL/MongoDB services
4. Replace hardcoded setup with `setup-environment.sh <target> --mode full`
5. Replace hardcoded commands with `run-command.sh` calls
6. Preserve Bun cache step
7. Fix all script path references to `ai-board/` prefix

**Dependencies**: Tasks 1, 2

---

### Task 5: Update `verify.yml` (Priority: P1)

**File**: `.github/workflows/verify.yml`

**Requirements covered**: FR-006, FR-007, FR-008, FR-011, FR-013

**Implementation details**:
1. Add service inputs
2. Replace static PostgreSQL with conditional expression
3. Add conditional services
4. Replace hardcoded setup with `setup-environment.sh <target> --mode full`
5. Replace hardcoded test commands:
   - `bun run test:unit --reporter=json` → `run-command.sh <target> test_unit` (with reporter args appended or handled via config)
   - `npx playwright test` → `run-command.sh <target> test_e2e`
6. **Special consideration**: verify.yml passes `--reporter=json` and `--outputFile` flags to test commands. These flags are framework-specific. The config command should be the base command; additional flags should be appended by the workflow step.
7. Preserve Bun cache step
8. Fix script path references

**Dependencies**: Tasks 1, 2

---

### Task 6: Update `health-scan.yml` (Priority: P1)

**File**: `.github/workflows/health-scan.yml`

**Requirements covered**: FR-006, FR-007, FR-008, FR-009, FR-011

**Implementation details**:
1. Add service inputs
2. Make PostgreSQL conditional (currently only starts for TESTS scan type — preserve this logic combined with `needs_postgres`)
3. Add conditional services
4. Replace hardcoded setup in TESTS path with `setup-environment.sh <target> --mode full`
5. Non-TESTS scan types: use `setup-environment.sh <target> --mode lightweight`
6. Replace hardcoded install/prisma commands with `run-command.sh` calls
7. Fix script path references

**Dependencies**: Tasks 1, 2

---

### Task 7: Update `ai-board-assist.yml` (Priority: P2)

**File**: `.github/workflows/ai-board-assist.yml`

**Requirements covered**: FR-008, FR-009, FR-011

**Implementation details**:
1. No service inputs needed (assist doesn't run tests directly)
2. Replace hardcoded `bun install --frozen-lockfile` with conditional setup:
   - For stages that need deps (VERIFY stage with /review): `setup-environment.sh <target> --mode full`
   - For other stages: `setup-environment.sh <target> --mode lightweight`
3. Replace hardcoded `npx prisma generate/migrate/seed` — handled by setup-environment.sh full mode
4. Replace hardcoded `npx playwright install` — handled by setup-environment.sh full mode
5. Fix script path references

**Dependencies**: Task 2

---

### Task 8: Update `iterate.yml` (Priority: P2)

**File**: `.github/workflows/iterate.yml`

**Requirements covered**: FR-008, FR-009, FR-011

**Implementation details**:
1. No service inputs needed (iterate doesn't run tests)
2. Replace any hardcoded setup with `setup-environment.sh <target> --mode lightweight`
3. Fix script path references
4. Minimal changes — this workflow is already lightweight

**Dependencies**: Task 2

---

### Task 9: Unit Tests for `run-command.sh` (Priority: P1)

**File**: `tests/unit/scripts/run-command.test.sh` (or Vitest wrapper)

**Test type**: Unit test (pure script behavior, no API/database)

**Test cases**:
1. With valid config: executes configured command, returns its exit code
2. With missing config: uses fallback default, returns exit code
3. With empty command value: exits 0 silently
4. With missing command key: exits 0 silently
5. With invalid YAML: exits 2 with error message
6. With unrecognized command key: exits 0 silently
7. Argument validation: fails with usage when args missing
8. Command failure: returns non-zero exit code faithfully

**Dependencies**: Task 1

---

### Task 10: Validation and Path Audit (Priority: P0)

**No file changes** — verification step.

**Requirements covered**: FR-011, SC-006

**Implementation details**:
1. Grep all workflow files for `../ai-board/` — must find zero matches
2. Grep all workflow files for hardcoded `bun install`, `bun run test`, `npx prisma`, `npx playwright` outside of comments — must find zero matches (except in run-command.sh fallback table)
3. Verify all `setup-environment.sh` calls use `ai-board/.github/scripts/` prefix
4. Verify all `run-command.sh` calls use `ai-board/.github/scripts/` prefix

**Dependencies**: Tasks 3-8

---

## Testing Strategy

| Test Type | Scope | Location | Tool |
|-----------|-------|----------|------|
| Unit | `run-command.sh` logic (config parsing, fallbacks, exit codes) | `tests/unit/scripts/` | Bash test or Vitest shell exec |
| Integration | Workflow YAML validation (valid syntax, required inputs present) | `tests/integration/` | Vitest + YAML parser |
| Manual | End-to-end workflow execution via `workflow_dispatch` | GitHub Actions | Manual trigger |

**Decision tree applied**:
- `run-command.sh` is a pure script with no React/API deps → **Unit test**
- Workflow YAML changes involve CI infrastructure → **Integration test** (validate YAML structure) + **Manual test** (actual execution)
- No E2E browser tests needed — this feature is entirely CI/CD infrastructure

---

## Dependency Graph

```
Task 1 (run-command.sh) ──┐
                          ├──► Tasks 3-6 (workflow updates with services) ──► Task 10 (audit)
Task 2 (setup-env mode) ──┤
                          ├──► Tasks 7-8 (lightweight workflow updates)
                          │
Task 1 ───────────────────┴──► Task 9 (unit tests)
```

**Parallelizable**:
- Tasks 1 and 2 (independent scripts)
- Tasks 3, 4, 5, 6 (independent workflow files, after Tasks 1+2)
- Tasks 7 and 8 (independent, after Task 2)
- Task 9 (after Task 1)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub Actions `image: ''` doesn't skip container | Low | High | Test with a simple workflow first; fallback to `if:` conditions on service steps |
| yq version incompatibility | Low | Medium | Pin to v4.44.1 (same as setup-environment.sh) |
| Fallback defaults drift from actual ai-board commands | Medium | Medium | Single source of truth in run-command.sh; add comment referencing .ai-board/config.yml |
| verify.yml test reporter flags incompatible with config commands | Medium | Medium | Append reporter flags after run-command.sh output, or use workflow-level env vars |
| Recursive setup-environment.sh + run-command.sh interaction | Low | Low | Scripts are independent — setup-environment.sh handles env, run-command.sh handles execution |

---

## Out of Scope

- **Dispatch-side changes**: The ai-board app code that dispatches workflows is not modified (separate ticket)
- **New config schema fields**: No changes to `.ai-board/config.yml` schema v1
- **deploy-preview.yml, rollback-reset.yml, auto-ship.yml, nightly-health.yml**: No project commands to universalize
- **Deprecation warnings**: Future work — emit warning when fallback defaults are used

---

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Feature spec | `specs/AIB-475-finalize-universal-workflows/spec.md` | Complete |
| Research | `specs/AIB-475-finalize-universal-workflows/research.md` | Complete |
| Data model | `specs/AIB-475-finalize-universal-workflows/data-model.md` | Complete |
| Contract: run-command.sh | `specs/AIB-475-finalize-universal-workflows/contracts/run-command.md` | Complete |
| Contract: setup-environment.sh | `specs/AIB-475-finalize-universal-workflows/contracts/setup-environment.md` | Complete |
| Contract: service inputs | `specs/AIB-475-finalize-universal-workflows/contracts/workflow-service-inputs.md` | Complete |
| Implementation plan | `specs/AIB-475-finalize-universal-workflows/plan.md` | Complete |
