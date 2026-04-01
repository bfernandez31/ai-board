# Implementation Plan: Create setup-environment.sh Script

**Branch**: `AIB-468-copy-of-create` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-468-copy-of-create/spec.md`

## Summary

Create a centralized `setup-environment.sh` script that reads `.ai-board/config.yml` from target repositories and handles all environment setup automatically. This replaces ~90+ duplicated setup lines across 6-8 GitHub Actions workflow files with a single script invocation. The script parses YAML config, installs runtimes and package managers, runs dependency installation, installs agent CLIs, exports environment variables, creates plugin symlinks, and validates the result.

## Technical Context

**Language/Version**: Bash 5.x (GitHub Actions ubuntu-latest runners)
**Primary Dependencies**: `yq` (YAML parser, pre-installed on GitHub Actions runners), GitHub Actions runner environment
**Storage**: N/A (filesystem operations only)
**Testing**: Vitest unit tests (for any TypeScript validation helpers), bash script integration tests via workflow execution
**Target Platform**: Linux (GitHub Actions ubuntu-latest runners)
**Project Type**: Single script + workflow YAML modifications
**Performance Goals**: Script completes full setup in <60s for a typical project
**Constraints**: Must work on GitHub Actions ubuntu-latest runners; must be idempotent; must not leak secrets
**Scale/Scope**: Replaces duplicated blocks in 6-8 workflow files; supports 4 package managers (bun, npm, yarn, pnpm)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ N/A | This is a bash script for CI/CD — TypeScript does not apply to shell scripts |
| II. Component-Driven Architecture | ✅ N/A | No UI components involved |
| III. Test-Driven Development | ✅ PASS | Unit tests planned for config validation; integration tested via workflow runs |
| IV. Security-First | ✅ PASS | Secrets take precedence over config values; env vars never logged; fail-fast on errors |
| V. Database Integrity | ✅ N/A | No database operations |
| V. Specification Clarification | ✅ PASS | Auto-resolved decisions documented with CONSERVATIVE fallback |

**Gate Result**: PASS — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-468-copy-of-create/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── cli-contract.md  # Script interface contract
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
.github/scripts/
└── setup-environment.sh    # The centralized setup script (NEW)

.ai-board/
└── config.yml              # Per-project configuration (NEW for ai-board itself)

.github/workflows/
├── speckit.yml             # MODIFIED — replace setup blocks with script call
├── quick-impl.yml          # MODIFIED — replace setup blocks with script call
├── verify.yml              # MODIFIED — replace setup blocks with script call
├── ai-board-assist.yml     # MODIFIED — replace setup blocks with script call
├── iterate.yml             # MODIFIED — replace setup blocks with script call
└── health-scan.yml         # MODIFIED — replace setup blocks with script call
```

**Structure Decision**: Single script in `.github/scripts/` (co-located with existing `setup-test-env.sh`). Config file in `.ai-board/` at project root per the platform-opening-design spec.

## Testing Strategy

| Component | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| Config YAML parsing/validation | Unit test | `tests/unit/setup-environment/` | Pure function logic — validate required fields, merge behavior |
| Script execution with valid config | Integration test | `tests/integration/setup-environment/` | Needs filesystem + actual tool installation |
| Script error handling (missing config, invalid YAML) | Integration test | `tests/integration/setup-environment/` | Needs real script execution to verify exit codes and messages |
| End-to-end workflow execution | Manual/CI validation | Workflow run | Requires GitHub Actions runner — verified by running actual workflows |

**Note**: The primary script is bash, so most testing is integration-level. Unit tests cover any TypeScript helper utilities if extracted. The bulk of validation happens through CI workflow runs.

## Complexity Tracking

*No constitution violations — this section is empty.*
