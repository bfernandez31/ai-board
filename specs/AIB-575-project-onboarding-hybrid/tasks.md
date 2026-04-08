# Tasks: Project Onboarding — Hybrid Workflow

**Input**: Design documents from `/specs/AIB-575-project-onboarding-hybrid/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, workflows/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed — this feature modifies existing workflow infrastructure, schema layer, and agent command system. Setup ensures foundational scripts directory exists.

- [x] T001 Verify `.github/scripts/` directory exists and contains `run-agent.sh`
- [x] T002 Verify `.claude-plugin/commands/` directory exists for new agent command

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config schema extensions that ALL user stories depend on — detection script output must validate against these enums.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational Phase
**RULE (constitution): Extend existing test file — `tests/unit/config-schema.test.ts` already covers config schema validation (50+ tests).**

- [x] T003 [P] Extend `tests/unit/config-schema.test.ts` with validation tests for new enum values: `ruby`, `php` languages; `bundler`, `composer` package managers; `rails`, `laravel`, `rspec`, `phpunit`, `actix`, `rocket` frameworks; and rejection of invalid values like `language: fortran`

### Implementation for Foundational Phase

- [x] T004 [P] Extend `ProjectLanguageSchema`, `PackageManagerSchema`, and `ProjectFrameworkSchema` enums in `lib/validations/config.ts` — add `ruby`, `php` languages; `bundler`, `composer` package managers; `rails`, `laravel`, `rspec`, `phpunit`, `actix`, `rocket` frameworks
- [x] T005 [P] Extend TypeScript type unions in `specs/AIB-449-define-ai-board/contracts/config-schema.ts` to match the new Zod enum values added in T004

**Checkpoint**: Config schema accepts all 7 language ecosystems. Tests pass.

---

## Phase 3: User Story 1 — Full Successful Onboarding (Priority: P1) 🎯 MVP

**Goal**: A project owner imports a repository and triggers onboarding. The system detects the tech stack, generates configuration and guidance files, and commits them. The callback reports COMPLETED with artifact summary.

**Independent Test**: Dispatch the onboard workflow against a sample TS/Next.js repository and verify committed files match expected detection results.

### Tests for User Story 1
**RULE (constitution): Create `tests/unit/detect-stack.test.ts` as NEW file — no existing test covers bash script output validation via Node subprocess.**

- [x] T006 [P] [US1] Create `tests/unit/detect-stack.test.ts` — test detection script output by running it against fixture directories using `child_process.execSync`:
  - Fixture: TypeScript/Next.js repo with `package.json` (next, prisma deps), `bun.lockb`, `vitest.config.ts`, `docker-compose.yml` with postgres service
  - Assert `config.yml` contains: language: typescript, framework: nextjs, packageManager: bun, testFramework: vitest, services includes postgres
  - Assert `analysis.json` structure matches data-model.md Analysis Result entity (language, framework, packageManager, testFramework, services, commands, manifests, lockfiles, configFiles, projectName, runtimeVersions, secondaryLanguages)
  - Test empty repo fixture (no manifests) → `config.yml` with `language: null`, projectName from directory name

### Implementation for User Story 1

- [x] T007 [US1] Create `.github/scripts/detect-stack.sh` — Phase 1 deterministic detection script:
  - Input: `$1` = path to target repository root
  - Use `set -euo pipefail` per `.claude-plugin/scripts/bash/common.sh` patterns
  - Scan manifest files to determine primary language (priority: `package.json` > `Cargo.toml` > `go.mod` > `pyproject.toml` > `pom.xml`/`build.gradle` > `Gemfile` > `composer.json`)
  - Detect package manager from lockfiles (`bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`, `Cargo.lock`, `poetry.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`)
  - Parse manifest dependencies for framework detection (next, react, django, fastapi, rails, laravel, actix, rocket, gin, spring)
  - Parse manifest dependencies for test framework detection (vitest, jest, pytest, playwright, rspec, phpunit)
  - Detect services from `docker-compose.yml` and ORM configs (Prisma → postgres)
  - Extract commands from `package.json` scripts, `Makefile` targets, `pyproject.toml` scripts
  - Generate `.ai-board/config.yml` using `cat <<EOF` (no YAML lib needed)
  - Generate `analysis.json` using `jq` with full Analysis Result structure from data-model.md
  - Exit 0 on success, 1 on detection failure

- [x] T008 [US1] Create `.claude-plugin/commands/ai-board.onboard.md` — Phase 2 LLM agent command per `specs/AIB-575-project-onboarding-hybrid/workflows/onboard-command.md`:
  - Accept `--analysis-json=<path>` and optional `--skip-claude-md` arguments
  - Read `analysis.json` for stack context
  - Generate `CLAUDE.md` with project-specific content (FR-017): tech stack, commands, data models, architecture, testing patterns, conventions
  - Generate `.ai-board/memory/constitution.md` with derived principles (FR-018): code patterns, testing standards, security practices, governance
  - Create `AGENTS.md` symlink → `CLAUDE.md`
  - Remove `analysis.json` after generation
  - Skip `CLAUDE.md` generation if `--skip-claude-md` flag is present

- [x] T009 [US1] Replace stub in `.github/workflows/onboard.yml` with real two-phase workflow per `specs/AIB-575-project-onboarding-hybrid/workflows/onboard-workflow.md`:
  - Inputs: `project_id`, `job_id`, `githubRepository`, `agent`
  - Step 1: Report RUNNING via callback (handle HTTP 409 for cancelled jobs)
  - Step 2: Fetch owner AI credential using speckit.yml credential pattern (curl + base64 decode + `::add-mask::`)
  - Step 3: Sparse checkout ai-board repo (`.claude-plugin`, `.github/scripts`) + full clone target repo via GH_PAT
  - Step 4: Run `detect-stack.sh target-repo` (Phase 1)
  - Step 5: Stage Phase 1 outputs (`.ai-board/config.yml`)
  - Step 6: Run `run-agent.sh` with `ai-board.onboard` command (Phase 2)
  - Step 7: Stage all generated files, commit `chore: initialize ai-board configuration`, push to default branch
  - Step 8: Build artifact summary (created/missing/preserved arrays)
  - Step 9: Report COMPLETED via callback with artifact summary and commit SHA
  - Set workflow timeout to 10 minutes

**Checkpoint**: Full onboarding works end-to-end for a TS/Next.js repository. Config + guidance files committed. Callback reports COMPLETED.

---

## Phase 4: User Story 2 — Partial Success When LLM Fails (Priority: P2)

**Goal**: When Phase 2 fails but Phase 1 succeeds, commit only Phase 1 outputs and report partial completion so the project is still minimally functional.

**Independent Test**: Simulate Phase 2 failure after Phase 1 success and verify partial commit + callback payload with `partial: true`.

### Tests for User Story 2

- [x] T010 [P] [US2] Extend `tests/unit/detect-stack.test.ts` with test case: verify detection script succeeds independently (exit code 0, valid outputs) even when called in isolation — confirms Phase 1 can succeed regardless of Phase 2

### Implementation for User Story 2

- [x] T011 [US2] Add partial success handling to `.github/workflows/onboard.yml`:
  - If Phase 2 (`run-agent.sh`) exits non-zero: continue execution (do not fail workflow)
  - Commit only Phase 1 outputs (`.ai-board/config.yml`) on Phase 2 failure
  - Build artifact summary with `partial: true`, `errorCode: "GUIDANCE_GENERATION_FAILED"`, created files vs missing files
  - Report COMPLETED (not FAILED) with partial artifact summary via callback
  - Use `continue-on-error: true` or `if: always()` pattern for Phase 2 step

**Checkpoint**: Phase 2 failure results in partial commit with config.yml only. Callback shows `partial: true` with correct created/missing arrays.

---

## Phase 5: User Story 3 — Multi-Language Stack Detection (Priority: P2)

**Goal**: Detection script correctly identifies tech stacks across all 7 supported ecosystems: Python/Django, Rust/Actix, Go/Gin, Java/Spring, Ruby/Rails, PHP/Laravel — not just TypeScript.

**Independent Test**: Run detection script against fixture directories for each ecosystem and validate generated `config.yml` against schema.

### Tests for User Story 3

- [x] T012 [P] [US3] Extend `tests/unit/detect-stack.test.ts` with multi-language fixture tests:
  - Python fixture: `pyproject.toml` with poetry + FastAPI deps → language: python, packageManager: poetry, framework: fastapi
  - Rust fixture: `Cargo.toml` with actix-web dep → language: rust, packageManager: cargo, framework: actix
  - Go fixture: `go.mod` with gin dep → language: go, framework: gin
  - Java fixture: `pom.xml` with spring-boot dep → language: java, packageManager: maven, framework: spring
  - Ruby fixture: `Gemfile` with rails dep, `Gemfile.lock` → language: ruby, packageManager: bundler, framework: rails
  - PHP fixture: `composer.json` with laravel dep, `composer.lock` → language: php, packageManager: composer, framework: laravel
  - Multi-language fixture: `package.json` + `pyproject.toml` → primary: typescript, secondaryLanguages includes python

### Implementation for User Story 3

- [x] T013 [US3] Extend `.github/scripts/detect-stack.sh` to fully support all 7 language ecosystems:
  - Python: parse `pyproject.toml` for dependencies (django, fastapi, flask); detect `poetry.lock`, `Pipfile.lock`, `requirements.txt` for package manager
  - Rust: parse `Cargo.toml` `[dependencies]` for frameworks (actix-web, rocket, axum); package manager always `cargo`
  - Go: parse `go.mod` `require` block for frameworks (gin, echo, fiber); detect `go.sum`
  - Java/Kotlin: parse `pom.xml` for spring-boot; parse `build.gradle`/`build.gradle.kts` for dependencies; detect maven vs gradle
  - Ruby: parse `Gemfile` for frameworks (rails, sinatra) and test frameworks (rspec); detect `Gemfile.lock` → bundler
  - PHP: parse `composer.json` `require` for frameworks (laravel, symfony) and test frameworks (phpunit); detect `composer.lock` → composer
  - Multi-language: identify primary language by manifest priority, record others in `secondaryLanguages` array in `analysis.json`

**Checkpoint**: Detection script produces correct `config.yml` for all 7 ecosystems. Multi-language repos identify primary + secondary languages.

---

## Phase 6: User Story 4 — Idempotent Re-Onboarding (Priority: P3)

**Goal**: Re-triggering onboarding preserves existing `CLAUDE.md` customizations while refreshing deterministic config.

**Independent Test**: Run onboarding twice — verify `CLAUDE.md` preserved on second run, `config.yml` regenerated fresh.

### Tests for User Story 4

- [x] T014 [P] [US4] Extend `tests/unit/detect-stack.test.ts` with idempotency test:
  - Fixture with existing `.ai-board/config.yml` → detection script overwrites it with fresh detection results
  - Fixture with existing `CLAUDE.md` → verify script does NOT touch `CLAUDE.md` (it's Phase 2's responsibility, not Phase 1)

### Implementation for User Story 4

- [x] T015 [US4] Add idempotency logic to `.github/workflows/onboard.yml`:
  - Before Phase 2: check if `CLAUDE.md` exists in target repo, set `SKIP_CLAUDE_MD` flag
  - Pass `--skip-claude-md` to `run-agent.sh` if `CLAUDE.md` exists (FR-010)
  - In artifact summary: add preserved `CLAUDE.md` to `preserved` array (not `created`)
  - `config.yml` always overwritten (deterministic, reflects current state per Decision 4)
  - `constitution.md` always regenerated fresh

**Checkpoint**: Re-onboarding preserves `CLAUDE.md`, refreshes `config.yml`, regenerates `constitution.md`. Artifact summary correctly reports preserved files.

---

## Phase 7: User Story 5 — Workflow Error Reporting (Priority: P3)

**Goal**: Every failure produces structured error codes in the callback payload for actionable setup page display.

**Independent Test**: Trigger each error condition and verify callback payload contains correct error code.

### Tests for User Story 5

- [x] T016 [P] [US5] Extend `tests/unit/detect-stack.test.ts` with error condition tests:
  - Non-existent repo path → exit code 1
  - Directory with no read permissions → exit code 1
  - Verify script produces clean error output (no partial `config.yml` or `analysis.json` on failure)

### Implementation for User Story 5

- [x] T017 [US5] Add structured error reporting to `.github/workflows/onboard.yml`:
  - `DISPATCH_FAILED`: report when target repo clone fails (Step 3)
  - `CONFIG_GENERATION_FAILED`: report when `detect-stack.sh` exits non-zero (Step 4)
  - `GUIDANCE_GENERATION_FAILED`: report when `run-agent.sh` exits non-zero (Step 6) — already partially handled in US2
  - `COMMIT_FAILED`: report when `git push` fails (Step 7)
  - Each error path sends PATCH callback with correct `errorCode` in `artifactSummary` and descriptive `errorMessage`
  - Add `if: failure()` catch-all step that reports FAILED if no specific error callback was sent

**Checkpoint**: Every failure mode produces a structured callback with the correct error code. No silent failures.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all phases.

- [x] T018 [P] Verify `detect-stack.sh` is executable (`chmod +x`) and has correct shebang (`#!/usr/bin/env bash`)
- [x] T019 [P] Validate `onboard.yml` workflow syntax with act or manual review — ensure all `${{ }}` expressions, secrets, and vars are correctly referenced
- [x] T020 Run all tests (`bun run test:unit tests/unit/detect-stack.test.ts` and `bun run test:unit tests/unit/config-schema.test.ts`) and verify they pass
- [x] T021 Run `bun run type-check` and `bun run lint` — fix any errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — core implementation
- **US2 (Phase 4)**: Depends on US1 (extends workflow with partial success logic)
- **US3 (Phase 5)**: Depends on US1 (extends detection script with more languages). Can run in parallel with US2
- **US4 (Phase 6)**: Depends on US1 (adds idempotency to workflow). Can run in parallel with US2, US3
- **US5 (Phase 7)**: Depends on US1 (adds error reporting to workflow). Can run in parallel with US2, US3, US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no dependencies on other stories
- **US2 (P2)**: Depends on US1 (workflow must exist before adding partial success)
- **US3 (P2)**: Depends on US1 (detection script must exist before extending languages)
- **US4 (P3)**: Depends on US1 (workflow must exist before adding idempotency)
- **US5 (P3)**: Depends on US1 (workflow must exist before adding error reporting)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Detection script before workflow (workflow invokes it)
- Agent command before workflow (workflow invokes it)
- Core implementation before edge case handling

### Parallel Opportunities

- T003, T004, T005 (Foundational) can all run in parallel
- T006, T010, T012, T014, T016 (test tasks across stories) can be written in parallel once US1 impl exists
- US2, US3, US4, US5 can all run in parallel after US1 completes (different concerns in same files but non-overlapping sections)
- T018, T019 (Polish) can run in parallel

---

## Parallel Example: Foundational Phase

```
# All foundational tasks target different files — run in parallel:
Task T003: Extend tests/unit/config-schema.test.ts with new enum validation tests
Task T004: Extend lib/validations/config.ts with new enum values
Task T005: Extend specs/AIB-449-define-ai-board/contracts/config-schema.ts with type unions
```

## Parallel Example: Post-US1 User Stories

```
# After US1 completes, these stories modify non-overlapping concerns:
Task US2: Partial success handling (workflow error paths)
Task US3: Multi-language detection (detect-stack.sh language blocks)
Task US4: Idempotency logic (workflow skip flags)
Task US5: Error code reporting (workflow callback paths)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify directories)
2. Complete Phase 2: Foundational (config schema extensions + tests)
3. Complete Phase 3: User Story 1 (detect-stack.sh + agent command + workflow)
4. **STOP and VALIDATE**: Run detection against a TS/Next.js repo fixture, verify config.yml + analysis.json
5. Deploy/demo if ready — onboarding works for the primary use case

### Incremental Delivery

1. Setup + Foundational → Schema supports all 7 ecosystems
2. US1 → Full happy path works for TS/Next.js → **MVP!**
3. US2 → Graceful degradation on LLM failure
4. US3 → All 7 language ecosystems detected correctly
5. US4 → Safe re-onboarding without losing customizations
6. US5 → Clear error messages for every failure mode
7. Polish → Final validation, lint, type-check

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially
2. Complete US1 sequentially (core implementation)
3. Once US1 is done, US2–US5 can run in parallel:
   - Parallel task 1: US2 (partial success)
   - Parallel task 2: US3 (multi-language)
   - Parallel task 3: US4 (idempotency)
   - Parallel task 4: US5 (error reporting)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Detection script uses bash + jq only (no external dependencies)
- Agent command is a markdown prompt file, not executable code
- Workflow follows existing speckit.yml patterns for credentials, checkout, callback
