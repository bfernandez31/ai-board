# Research: Generic Health Tests: Make TESTS Scan Work on Any Project

**Feature**: AIB-588
**Date**: 2026-04-09

## Existing Files

| Path | What it covers | Extend or create new |
|------|----------------|----------------------|
| `.github/scripts/detect-stack.sh` | Deterministic stack detection, manifest scraping, config generation, analysis output | Extend |
| `.github/scripts/run-command.sh` | Config-driven command execution with fallback defaults | Extend |
| `scripts/run-health-tests.sh` | ai-board TESTS orchestrator, score calculation, fix loop, result file generation | Extend |
| `scripts/run-tests-with-reports.sh` | Executes unit/integration/e2e suites and writes JSON summaries | Extend |
| `.github/workflows/health-scan.yml` | Workflow routing, target checkout, scan execution, status updates, ticket generation | Extend |
| `lib/health/scan-dispatch.ts` | Dispatches `health-scan.yml` and injects TESTS-specific service inputs | Extend |
| `lib/workflows/service-inputs.ts` | Maps stored config services to workflow inputs | Reuse as-is for services, extend only if new workflow inputs are added |
| `lib/validations/config.ts` | Zod schema for `.ai-board/config.yml` | Extend |
| `lib/config-loader.ts` | Reads/parses/validates repo config | Extend only if new config fields need loader-level guidance |
| `lib/config-sync.ts` | Fetches repo config from GitHub, validates it, strips secrets, stores JSON in `Project.config` | Extend |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Persists scan status transitions, handles skipped scans, updates `HealthScore` | Extend |
| `lib/health/report-schemas.ts` | Zod schemas for stored scan report payloads | Likely reuse as-is for report body, verify result-envelope compatibility |
| `tests/unit/detect-stack.test.ts` | Existing unit coverage for stack detection output across ecosystems | Extend |
| `tests/unit/config-schema.test.ts` | Existing unit coverage for config shape and enum support | Extend |
| `tests/unit/config-loader.test.ts` | Existing unit coverage for config parsing/validation failure modes | Extend |
| `tests/unit/scripts/run-command.test.ts` | Existing unit coverage for config-driven shell command execution | Extend if behavior changes |
| `tests/unit/health/report-schemas.test.ts` | Existing unit coverage for valid TESTS report parsing | Extend only if stored report shape changes |
| `tests/unit/health/command-output-validation.test.ts` | Existing unit coverage for TESTS report schema invariants | Reuse as-is unless report schema changes |
| `tests/integration/health/scan-status.test.ts` | Existing integration coverage for `SKIPPED` transitions on health scans | Extend |
| `tests/unit/scripts/run-health-tests.test.ts` | No existing file covers shell orchestrator target-dir/skip behavior | Create new |

Test inventory conclusion: constitution rule "Search existing tests FIRST — extend, don't duplicate" is satisfied. All changes map to existing domain tests except `scripts/run-health-tests.sh`, which currently has no dedicated test file.

## Patterns to Follow

### Error handling patterns

- **Config fetch/validation returns typed outcomes instead of throwing for expected failures**  
  Reference: `lib/config-sync.ts:67-137`  
  Pattern: GitHub fetch, YAML parse, and validation failures return explicit typed error codes (`CONFIG_NOT_FOUND`, `YAML_PARSE_ERROR`, `VALIDATION_ERROR`) rather than generic exceptions.  
  Apply to new work: missing test commands in detected config should produce explicit skip reasons, not generic execution failures.

- **Workflow dispatch throws only after contextual logging**  
  Reference: `lib/health/scan-dispatch.ts:49-71`  
  Pattern: log the failure with scan context, then throw a wrapped error upward.  
  Apply to new work: if TESTS workflow routing cannot locate the shared orchestrator or target config, fail early with a contextual message.

- **Status route validates state transitions before persistence**  
  Reference: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts:121-164`  
  Pattern: parse input, find the scan, coerce/validate status, then build update payload; only afterward persist in a transaction.  
  Apply to new work: TESTS skip support should be implemented by adjusting guards, not bypassing transition validation.

### Security patterns

- **Config secrets are stripped before DB persistence**  
  Reference: `lib/config-sync.ts:139-156`  
  Pattern: `stripServiceCredentials()` and `env` removal happen before `Project.config` is stored.  
  Apply to new work: test capability metadata must stay non-secret and live alongside the existing stripped config, not introduce any persisted credential fields.

- **Workflow inputs are copied into env vars before shell usage**  
  Reference: `.github/workflows/health-scan.yml:114-124`  
  Pattern: dispatch inputs are surfaced as environment variables to avoid direct interpolation into `run:` blocks.  
  Apply to new work: target repo path or command-key inputs for the shared TESTS orchestrator should continue to travel through env vars or quoted script args.

### State management patterns

- **Optimistic locking for config refresh**  
  Reference: `lib/config-sync.ts:143-173`  
  Pattern: update with `configSyncedAt` guard, then re-read on contention.  
  Apply to new work: do not add any config mutation path that bypasses this sync flow.

- **Score changes only on completed scans**  
  Reference: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts:166-219`  
  Pattern: `HealthScore` aggregate updates only when `effectiveStatus === 'COMPLETED'`.  
  Apply to new work: allowing TESTS to skip must preserve this behavior so the prior `testsScore` remains visible.

- **Degradation guard in fix loop**  
  Reference: `scripts/run-health-tests.sh:177-188`  
  Pattern: compare failed-count before/after fix iteration, revert if the run got worse, then stop.  
  Apply to new work: target-aware orchestration must preserve the same dispatch-then-rollback behavior, but scope the rollback to the explicit target repo instead of assuming the current repo shell context.

## Research Question 1: How should stack detection record reusable test capability data?

**Decision**: Extend `detect-stack.sh` to normalize discovered commands into shared config keys and a compact test capability profile: primary runnable test command(s), detected framework, and whether E2E coverage signals exist.

**Rationale**: The current script already detects test frameworks and manifest commands, but it only writes `commands.install` into `.ai-board/config.yml` and leaves the richer findings inside `analysis.json`. Health scans need the durable config, not an onboarding-only artifact.

**Alternatives considered**:
- Continue using raw `analysis.json` at scan time: rejected because health scans run long after onboarding and already rely on `Project.config`
- Hardcode ai-board defaults in the workflow: rejected by FR-002 and FR-011
- Require every project owner to hand-author the test commands: rejected because stack detection is explicitly part of the feature

## Research Question 2: Where is the current portability break for TESTS scans?

**Decision**: Move TESTS orchestration to the ai-board checkout and pass the target repo path into the shared scripts.

**Rationale**: The current workflow step runs `./scripts/run-health-tests.sh` from `working-directory: target` in `.github/workflows/health-scan.yml:332-389`, which assumes the target repo copied ai-board’s shell orchestrator. That directly violates FR-001 and FR-011.

**Alternatives considered**:
- Copy ai-board scripts into every managed repo: rejected because the spec explicitly forbids repo-local orchestration requirements
- Keep the target-local call and only improve config detection: rejected because the workflow would still fail when the script is absent
- Replace the shell orchestrator with an LLM-only skill: rejected because the current deterministic first-run/fix-loop behavior is intentionally preserved

## Research Question 3: How should TESTS scans behave when no command is runnable?

**Decision**: A missing executable test command produces a successful workflow run with `/tmp/health-scan-result.json` marked `skipped: true`, `score: null`, and a human-readable `skipReason`, followed by a persisted `HealthScan.status = SKIPPED`.

**Rationale**: This matches FR-007, FR-013, and the acceptance scenarios. It also fits the existing health model, which already supports `SKIPPED` scans generically.

**Alternatives considered**:
- Treat missing commands as workflow failure: rejected because it creates false negatives for non-test-ready repos
- Emit a fake zero score: rejected because skipped scans must preserve prior aggregates and remain distinguishable from execution failures
- Keep the current TESTS-not-skippable guard: rejected because it contradicts the feature spec

## Research Question 4: Which current guards conflict with the new spec?

**Decision**: Remove or relax both TESTS skip prohibitions:
- workflow-level coercion in `.github/workflows/health-scan.yml:344-355`
- API-level coercion in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts:94-104`

**Rationale**: The workflow and API currently override `TESTS` skips to completed or reject them without a score. The feature requires the opposite behavior.

**Alternatives considered**:
- Keep the guards and encode skip inside a completed report: rejected because operators could not distinguish skipped from executed outcomes
- Allow skip in the workflow but not in the API: rejected because persistence would still fail

## Research Question 5: How should ai-board self-management compatibility be preserved?

**Decision**: Preserve ai-board behavior by ensuring ai-board’s own config contains the same detected commands that the generic flow consumes, not by retaining special workflow assumptions for the ai-board repo.

**Rationale**: A genuinely generic path must work identically for ai-board and external repos. The existing fallback defaults in `run-command.sh` remain useful for setup commands, but TESTS execution should no longer depend on ai-board-specific repo structure.

**Alternatives considered**:
- Keep a separate ai-board-only branch in the TESTS workflow: rejected because it would preserve the portability bug in the main path
- Remove all defaults everywhere: rejected because onboarding/setup compatibility still benefits from fallback behavior outside the TESTS scan flow

## Research Question 6: What is the minimum file surface for the implementation?

**Decision**: The implementation must touch detection/config, shared TESTS orchestration, workflow routing, and status persistence. It is not sufficient to change only `detect-stack.sh` or only `health-scan.yml`.

**Rationale**: Portability currently fails at multiple layers: config generation, target-local script invocation, and TESTS skip persistence.

**Alternatives considered**:
- Detection-only change: rejected because the workflow still calls a missing target-local script
- Workflow-only change: rejected because the generic workflow would still lack trustworthy test commands to run
