# Implementation Plan: Create setup-environment.sh Script

**Branch**: `AIB-450-create-setup-environment` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-450-create-setup-environment/spec.md`

## Summary

Create a centralized `setup-environment.sh` bash script at `.github/scripts/setup-environment.sh` that reads `.ai-board/config.yml` from a target repository directory and performs all environment setup (Node.js, package manager, dependencies, agent CLI, env vars, plugin symlinks). This replaces 15-20 lines of duplicated setup code across 6+ GitHub Actions workflow YAML files with a single script invocation.

## Technical Context

**Language/Version**: Bash (POSIX-compatible with bashisms for arrays/associative features)
**Primary Dependencies**: yq (YAML parser), actions/setup-node, oven-sh/setup-bun, corepack (for yarn/pnpm)
**Storage**: N/A (filesystem operations only — symlinks, config file reads)
**Testing**: Vitest (unit tests for any Node.js helpers), bash script testing via integration tests with mock target directories
**Target Platform**: GitHub Actions runners (Ubuntu 22.04/24.04), Linux
**Project Type**: Single script (part of existing CI/CD infrastructure)
**Performance Goals**: Complete all setup steps in under 3 minutes (SC-001)
**Constraints**: Must be idempotent, must work in GitHub Actions environment, must degrade gracefully when run locally
**Scale/Scope**: 6+ workflow files consuming the script, supports 4 package managers (bun, npm, yarn, pnpm), 2 agent CLIs (claude-code, codex)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | N/A | This is a bash script for CI setup — TypeScript is not applicable. No app code is being written. |
| II. Component-Driven Architecture | N/A | No UI components involved. |
| III. Test-Driven Development | PASS | Integration tests will verify script behavior against mock configs. Unit tests for any helper logic. |
| IV. Security-First Design | PASS | No secrets hardcoded; env var merge ensures secrets take precedence over config values; no raw user input executed without validation. |
| V. Database Integrity | N/A | No database operations. |
| V. Specification Clarification Guardrails | PASS | All auto-resolved decisions documented in spec with rationale and trade-offs. |

**Gate Result**: PASS — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-450-create-setup-environment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (separate command)
```

### Source Code (repository root)

```
.github/
└── scripts/
    └── setup-environment.sh    # Main script (NEW)

.ai-board/
└── config.yml                  # Declarative project config (already defined in platform-opening-design)

tests/
└── integration/
    └── setup-environment/      # Integration tests
        ├── setup-environment.test.ts
        └── fixtures/
            ├── valid-bun-config.yml
            ├── valid-npm-config.yml
            ├── valid-yarn-config.yml
            ├── valid-pnpm-config.yml
            ├── missing-required-fields.yml
            ├── unsupported-manager.yml
            └── python-runtime.yml
```

**Structure Decision**: Single script at `.github/scripts/setup-environment.sh` — aligns with the location specified in platform-opening-design.md Section 2. Test fixtures provide mock configs for each supported scenario.

## Complexity Tracking

*No constitution violations to justify.*

## Design Decisions

### D1: YAML Parsing Approach

**Decision**: Use `yq` (mikefarah/yq) for YAML parsing — pre-installed on GitHub Actions runners.
**Rationale**: Native bash has no YAML parser. `yq` is lightweight, already available on runners, and handles nested YAML well. Alternative `python -c "import yaml"` adds Python dependency.
**Fallback**: If `yq` is not available, script exits with clear error directing to install it.

### D2: Package Manager Installation Strategy

**Decision**: Use `corepack enable` for yarn/pnpm (Node.js built-in), direct install for bun (via `oven-sh/setup-bun` action or `curl`), npm comes with Node.js.
**Rationale**: Corepack is the Node.js-blessed way to manage yarn/pnpm versions. Bun has its own installer. npm is bundled with Node.
**Impact**: Script must handle both GitHub Actions context (where actions like `setup-node` are available) and standalone invocation.

### D3: Script Execution Model

**Decision**: Script runs as a single `bash` invocation from workflow step `run:` block, NOT as a composite action.
**Rationale**: `run:` steps are simpler, debuggable via workflow logs, and don't require action.yml metadata. The platform-opening-design explicitly shows `run: ../ai-board/.github/scripts/setup-environment.sh target/`.

### D4: Environment Variable Export Strategy

**Decision**: Write config env vars to `$GITHUB_ENV` when in GitHub Actions, fall back to `export` for local runs.
**Rationale**: `$GITHUB_ENV` persists env vars across workflow steps. Plain `export` only works within the same shell session. Detecting the environment via `$GITHUB_ACTIONS` variable.

### D5: Plugin Symlink Paths

**Decision**: Symlinks are relative paths from target dir to ai-board plugin directories, matching the existing pattern: `../../ai-board/.claude-plugin/commands`.
**Rationale**: Relative paths work regardless of workspace root. This matches the current working symlink pattern in all 6+ workflows.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| US1: Standard Node.js setup | Integration | `tests/integration/setup-environment/` | Requires filesystem, process execution — not a pure function |
| US2: Missing/invalid config | Integration | `tests/integration/setup-environment/` | Tests script exit codes and error messages |
| US3: Multiple package managers | Integration | `tests/integration/setup-environment/` | Requires verifying tool installation |
| US4: Agent CLI installation | Integration | `tests/integration/setup-environment/` | Requires verifying CLI availability |
| US5: Idempotent symlinks | Integration | `tests/integration/setup-environment/` | Filesystem state verification |
| Config YAML parsing logic | Unit | `tests/unit/` | If extracted to a Node.js helper (optional) |

**Approach**: Integration tests invoke the script against fixture directories with various config files and assert on exit codes, stdout messages, and filesystem state (symlinks exist, correct targets). Tests mock external tool installations where needed to keep them fast.

## Implementation Phases

### Phase A: Core Script Structure
1. Create `.github/scripts/setup-environment.sh` with argument parsing, config loading via `yq`, and validation of required fields
2. Implement step logging (`echo "::group::Step N: Description"` for GitHub Actions collapsible groups)
3. Implement fail-fast error handling with actionable messages

### Phase B: Runtime & Dependencies
4. Implement Node.js version detection and setup (via `nvm` or `setup-node` output)
5. Implement package manager installation (bun via installer, yarn/pnpm via corepack, npm bundled)
6. Implement `commands.install` execution

### Phase C: Agent CLI & Environment
7. Implement agent CLI installation (claude-code → `npm install -g @anthropic-ai/claude-code`, codex → `npm install -g @openai/codex`)
8. Implement env var export (config → `$GITHUB_ENV` or `export`)
9. Implement plugin symlink creation (idempotent, with real-directory conflict detection)

### Phase D: Testing & Integration
10. Create test fixtures (valid and invalid config YAMLs)
11. Write integration tests for happy path and error cases
12. Verify script works end-to-end in a workflow dry-run

### Phase E: Workflow Migration (separate ticket — documented here for context)
- Replace duplicated setup blocks in all 6+ workflow YAMLs with single script call
- This is NOT in scope for AIB-450 but is the immediate follow-up
