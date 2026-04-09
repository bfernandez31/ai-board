# Implementation Plan: Generic Health Tests: Make TESTS Scan Work on Any Project

**Branch**: `AIB-588-generic-health-tests` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-588-generic-health-tests/spec.md`

## Summary

Make the `TESTS` health scan platform-owned and config-driven so any managed repository can run it without copying ai-board orchestration files into the target repo. The design extends stack detection to emit reusable test capability metadata, updates config validation/sync to preserve that metadata, routes `TESTS` execution through ai-board-owned scripts against the checked-out target repo, and allows `TESTS` scans to finish as `SKIPPED` with a clear reason when no executable automated test command exists.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Bash, GitHub Actions YAML, Prisma 6.x
**Primary Dependencies**: Next.js App Router API routes, Octokit, Zod, YAML, `jq`, `yq`, Bun on ai-board; target repos may use Bun/npm/pnpm/yarn/poetry/cargo/go tooling
**Storage**: Existing `Project.config` JSON and `HealthScan` / `HealthScore` records in PostgreSQL; no new tables required
**Testing**: Extend Vitest unit tests for stack detection, config schema/loading, health report parsing, and shell scripts; extend Vitest integration tests for health scan status transitions
**Target Platform**: GitHub Actions runners orchestrating ai-board + target-repo sibling checkouts
**Project Type**: Multi-layer workflow feature spanning shell scripts, workflow YAML, API route logic, config schema, and tests
**Performance Goals**: Preserve current ai-board TESTS behavior and retry limits; avoid extra setup for scans that must skip early
**Constraints**:
- External repos may not contain `scripts/run-health-tests.sh` or ai-board-specific test commands
- Shared configuration, not repo-local orchestration assets, is the source of truth for runnable test commands
- `TESTS` scans must now support `SKIPPED`, even though current workflow and API guards explicitly forbid it
- Scoring must remain based on the first execution only
**Scale/Scope**: `.github/scripts/detect-stack.sh`, `.github/scripts/run-command.sh`, `scripts/run-health-tests.sh`, `scripts/run-tests-with-reports.sh`, `.github/workflows/health-scan.yml`, config validation/sync files, health status API route, and related tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | TypeScript changes stay strict; shell/YAML changes remain bounded to workflow tooling |
| II. Component-Driven Architecture | N/A | No UI component changes planned |
| III. Test-Driven Development | ✅ PASS | Existing tests were inventoried first; plan extends current domain tests and creates one new shell-script test only where no current file covers the responsibility |
| IV. Security-First Design | ✅ PASS | Secrets continue to come from env/workflow inputs; config sync still strips env credentials before persisting; new command execution remains repo-committed config driven |
| V. Database Integrity | ✅ PASS | No schema migration planned; `HealthScan` state handling remains transactional and `HealthScore` updates stay limited to completed scans |
| V. Specification Clarification | ✅ PASS | Spec already includes auto-resolved decisions; plan resolves remaining implementation ambiguities in `research.md` |

**Gate Result**: ✅ PASS

## Project Structure

### Documentation (this feature)

```text
specs/AIB-588-generic-health-tests/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   ├── health-scan-status-patch.md
│   ├── project-config-tests-profile.md
│   └── tests-health-result.md
└── workflows/
    ├── health-scan-routing-workflow.md
    ├── stack-detection-command.md
    ├── stack-detection-workflow.md
    ├── tests-health-scan-command.md
    └── tests-health-scan-workflow.md
```

### Source Code (repository root)

```text
.github/
├── scripts/
│   ├── detect-stack.sh
│   ├── run-command.sh
│   └── setup-environment.sh
└── workflows/
    └── health-scan.yml
app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts
lib/
├── config-loader.ts
├── config-sync.ts
├── health/
│   ├── report-schemas.ts
│   └── scan-dispatch.ts
├── validations/config.ts
└── workflows/service-inputs.ts
scripts/
├── run-health-tests.sh
└── run-tests-with-reports.sh
tests/
├── integration/health/scan-status.test.ts
├── unit/config-loader.test.ts
├── unit/config-schema.test.ts
├── unit/detect-stack.test.ts
├── unit/health/command-output-validation.test.ts
├── unit/health/report-schemas.test.ts
├── unit/scripts/run-command.test.ts
└── unit/scripts/run-health-tests.test.ts   # NEW
```

## Complexity Tracking

No constitution violations require justification. The main complexity is behavioral, not structural: replacing target-local orchestration with platform-owned orchestration while preserving ai-board self-scan parity.

## Phase 0 Findings

Research is captured in [research.md](./research.md). The critical design decisions are:

1. Stack detection must emit normalized commands for `test_unit`, `test_integration`, `test_e2e`, `lint`, and `type_check` instead of only dumping raw manifest commands.
2. The shared TESTS orchestrator must execute from the ai-board checkout and accept a target repo path rather than expecting `./scripts/run-health-tests.sh` inside the target repo.
3. The workflow result file and PATCH status endpoint must allow `TESTS` scans to persist `SKIPPED` with `skipReason`, while continuing to preserve prior `HealthScore` aggregates.
4. ai-board compatibility should be preserved by generating and consuming config for ai-board itself, not by keeping ai-board-only workflow assumptions in the generic path.

## Design Details

### 1. Shared Project Configuration

**Files**: `.github/scripts/detect-stack.sh`, `lib/validations/config.ts`, `lib/config-loader.ts`, `lib/config-sync.ts`

**Design**:
- Extend deterministic detection to populate concrete config command keys rather than only writing `install`
- Add test capability metadata to config as a typed, validated structure so workflows can distinguish available commands, detected framework, and E2E presence
- Keep ambiguous signals empty instead of inventing commands; that empty state drives a later `SKIPPED` result
- Preserve env stripping and optimistic locking in config sync

### 2. Platform-Owned TESTS Orchestration

**Files**: `scripts/run-health-tests.sh`, `scripts/run-tests-with-reports.sh`, `.github/workflows/health-scan.yml`, `lib/health/scan-dispatch.ts`

**Design**:
- Invoke ai-board-owned TESTS scripts from the platform checkout, passing the target repo directory explicitly
- Read the target repo’s config to choose runnable test commands; skip cleanly when none are defined
- Preserve current scoring-from-first-run and retry-based remediation loop
- Replace destructive revert behavior with target-scoped rollback that follows existing safe patterns and does not assume the current shell cwd is the repo under repair

### 3. Scan Status and Reporting

**Files**: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`, `lib/health/report-schemas.ts`, `tests/*health*`

**Design**:
- Remove the current `TESTS cannot be SKIPPED` coercion in both workflow and API layers
- Persist `skipReason` for TESTS the same way other scannable modules already persist skipped context
- Keep `HealthScore` updates restricted to `COMPLETED` scans so skipped test runs preserve the prior aggregate score
- Ensure report parsing continues to accept valid `TESTS` reports, while the workflow-level result envelope gains `skipped` and `skipReason`

## Testing Strategy

Use the constitution’s default choice of Vitest unit/integration tests first.

| Test Type | Location | Plan |
|-----------|----------|------|
| Unit | `tests/unit/detect-stack.test.ts` | Extend to assert detected test command, framework classification, lint/type-check detection, and `hasE2E` signal across multiple ecosystems |
| Unit | `tests/unit/config-schema.test.ts` | Extend schema validation for new config fields and nullable/absent command behavior |
| Unit | `tests/unit/config-loader.test.ts` | Extend parsing coverage for new config shape |
| Unit | `tests/unit/scripts/run-command.test.ts` | Extend only if command resolution semantics change for target-aware test execution |
| Unit | `tests/unit/health/report-schemas.test.ts` and `tests/unit/health/command-output-validation.test.ts` | Confirm TESTS reports remain valid while skipped result envelope changes stay outside report schema |
| Unit | `tests/unit/scripts/run-health-tests.test.ts` | New file justified because no existing test covers the shell orchestrator’s skip/target-dir behavior |
| Integration | `tests/integration/health/scan-status.test.ts` | Extend to verify `TESTS` can transition `RUNNING -> SKIPPED`, preserves prior aggregate, and stores skip reason |

## Implementation Order

1. Extend detection/config contracts so a target repo can describe how tests run
2. Update config validation/loading/sync to preserve the new shape end-to-end
3. Refactor platform-owned TESTS scripts to operate on an explicit target repo path
4. Update `health-scan.yml` and dispatch inputs to route TESTS through ai-board-owned orchestration
5. Remove TESTS skip guards from workflow and API status handling
6. Extend existing tests and add the new orchestrator unit test

## Post-Phase 1 Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | New config/report fields are modeled explicitly and validated with Zod |
| III. Test-Driven Development | ✅ PASS | Real existing test files are named in the plan; only one new file is proposed where no current test owns the shell orchestrator |
| IV. Security-First Design | ✅ PASS | Config sync still strips env credentials; workflow-owned scripts keep secrets in environment variables; no weaker credential path introduced |
| V. Database Integrity | ✅ PASS | `SKIPPED` TESTS scans intentionally avoid aggregate score mutation, preserving existing consistency guarantees |

**Gate Result**: ✅ PASS
