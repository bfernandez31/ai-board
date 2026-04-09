# Feature Specification: Project Onboarding — Hybrid Workflow with Stack Detection and LLM Generation

**Feature Branch**: `AIB-575-project-onboarding-hybrid`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Replace the stub onboard.yml workflow with a real two-phase hybrid workflow: deterministic stack detection (Phase 1) followed by LLM-powered content generation (Phase 2)"

## Auto-Resolved Decisions

### Decision 1: Config Schema Extension Strategy

- **Decision**: Extend the existing config validation schema to include Ruby, PHP languages; bundler, composer package managers; and Rails, Laravel, Actix, Rocket framework values — rather than creating a separate onboarding-only schema. RSpec and PHPUnit are test frameworks (detected as `testFramework` in analysis.json), not application frameworks, and are therefore excluded from `ProjectFrameworkSchema`
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9, score -6) — internal infrastructure with no user-facing ambiguity
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Extends the shared schema used by all config validation — any typo affects existing projects
  2. Simpler than maintaining two schemas; single source of truth
- **Reviewer Notes**: Verify new enum values don't conflict with existing config files already deployed

### Decision 2: Partial Success Reporting Shape

- **Decision**: On Phase 2 failure, the workflow commits Phase 1 outputs and reports COMPLETED (not FAILED) with `partial: true` in `artifactSummary` JSON, plus a list of files created vs missing. This allows the setup page to show a usable but incomplete state.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) — partial success is better than total failure for an internal onboarding step
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The project becomes minimally functional (config synced) even if LLM generation fails
  2. Requires the setup page (AIB-577) to handle partial state display — already scoped there
- **Reviewer Notes**: Confirm AIB-577 setup page can render partial artifact summaries

### Decision 3: Commit Strategy — Single Atomic Commit to Default Branch

- **Decision**: All generated files are committed directly to the target repo's default branch in a single commit, not via a pull request. This is an initialization step on a new project where branch protection is not yet expected.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) — onboarding runs once on freshly imported repos
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simpler and faster than creating a PR for review
  2. If the repo has branch protection enabled, the push will fail with a clear `COMMIT_FAILED` error code
- **Reviewer Notes**: Document that repos with branch protection must temporarily allow pushes or use a bot with bypass permissions

### Decision 4: Idempotency — Skip Existing Files

- **Decision**: If `CLAUDE.md` already exists, Phase 2 preserves it. If `.ai-board/config.yml` already exists, Phase 1 overwrites it (config is deterministic and should reflect current repo state). `constitution.md` is always generated fresh during onboarding.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) — config should be current; guidance files are expensive to regenerate
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Overwriting config means re-onboarding always gets the latest stack detection
  2. Preserving CLAUDE.md respects user customizations made after initial onboarding
- **Reviewer Notes**: Consider whether constitution.md should also be preserved if it already exists

### Decision 5: Credential Fetching for Target Repo Access

- **Decision**: The workflow uses the project owner's stored AI credential (fetched via internal API) for the LLM agent, and `GH_PAT` secret for target repo clone/push access — consistent with existing speckit.yml patterns
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) — reuses proven credential patterns from existing workflows
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Relies on owner having a valid credential stored — blocked if missing (AIB-577 validates this before dispatch)
  2. Consistent with existing workflow security model
- **Reviewer Notes**: Ensure GH_PAT has write access to push commits to target repos

## User Scenarios & Testing

### User Story 1 - Full Successful Onboarding (Priority: P1)

A project owner imports a repository and triggers onboarding. The system analyzes the repo, detects the tech stack, generates configuration and guidance files, and commits them to the repository. The setup page updates to show completion with all files created.

**Why this priority**: This is the core happy path — without it, no project can be onboarded.

**Independent Test**: Can be fully tested by dispatching the onboard workflow against a sample repository and verifying the committed files match expected detection results.

**Acceptance Scenarios**:

1. **Given** a TypeScript/Next.js repository with Prisma and Vitest, **When** the onboard workflow runs, **Then** `.ai-board/config.yml` contains correct language (typescript), framework (nextjs), package manager, services (postgres from Prisma), and test framework (vitest)
2. **Given** the same repository, **When** Phase 2 completes, **Then** `CLAUDE.md` contains project-specific architecture details (not generic templates), `constitution.md` contains principles derived from observed patterns, and `AGENTS.md` is a symlink to `CLAUDE.md`
3. **Given** both phases complete, **When** the workflow finishes, **Then** all files are committed in a single atomic commit with message `chore: initialize ai-board configuration`, and the callback reports COMPLETED with artifact summary and commit SHA

---

### User Story 2 - Partial Success When LLM Fails (Priority: P2)

The detection phase succeeds but the LLM generation phase fails (timeout, credential issue, model error). The system commits the deterministic outputs and reports partial completion so the project is still minimally functional.

**Why this priority**: LLM failures are the most likely failure mode — the system must degrade gracefully.

**Independent Test**: Can be tested by simulating Phase 2 failure after Phase 1 success and verifying partial commit and callback payload.

**Acceptance Scenarios**:

1. **Given** Phase 1 produces valid `config.yml` and `analysis.json`, **When** Phase 2 fails, **Then** only Phase 1 outputs are committed to the default branch
2. **Given** partial success, **When** the callback is sent, **Then** it reports COMPLETED with `partial: true`, lists files created vs missing, and includes error code `GUIDANCE_GENERATION_FAILED`
3. **Given** partial onboarding, **When** the project is viewed in the setup page, **Then** it shows which files were generated and which are missing

---

### User Story 3 - Multi-Language Stack Detection (Priority: P2)

The detection script correctly identifies the technology stack across diverse repository types: Python/Django, Rust/Actix, Go/Gin, Java/Spring Boot, Ruby/Rails, PHP/Laravel — not just TypeScript/JavaScript.

**Why this priority**: Multi-language support is a key differentiator from a simple template approach.

**Independent Test**: Can be tested by running the detection script against sample repos with known stacks and validating the generated `config.yml` against the schema.

**Acceptance Scenarios**:

1. **Given** a Python repository with `pyproject.toml`, `poetry.lock`, and FastAPI in dependencies, **When** the detection script runs, **Then** `config.yml` contains language: python, packageManager: poetry, framework: fastapi
2. **Given** a Rust repository with `Cargo.toml` and Actix in dependencies, **When** the detection script runs, **Then** `config.yml` contains language: rust, packageManager: cargo, framework: actix
3. **Given** a Go repository with `go.mod` and Gin in dependencies, **When** the detection script runs, **Then** `config.yml` contains language: go, framework: gin, and `runtime.manager` is null (Go uses built-in module system; no external package manager applies)

---

### User Story 4 - Idempotent Re-Onboarding (Priority: P3)

A project owner re-triggers onboarding on a previously onboarded repo. The system refreshes the deterministic config but preserves any existing `CLAUDE.md` that may have been customized.

**Why this priority**: Prevents accidental loss of user customizations while keeping config current.

**Independent Test**: Can be tested by running onboarding twice on the same repo and verifying CLAUDE.md is preserved while config.yml is refreshed.

**Acceptance Scenarios**:

1. **Given** a repo with an existing `CLAUDE.md` containing custom content, **When** onboarding runs, **Then** the existing `CLAUDE.md` is preserved unchanged
2. **Given** a repo with an outdated `.ai-board/config.yml`, **When** onboarding runs, **Then** `config.yml` is regenerated from current repo state

---

### User Story 5 - Workflow Error Reporting (Priority: P3)

When any phase of the workflow fails, structured error codes and messages are reported back through the callback API so the setup page can display actionable information.

**Why this priority**: Clear error reporting enables users to self-diagnose issues.

**Independent Test**: Can be tested by triggering each error condition and verifying the callback payload contains the correct error code.

**Acceptance Scenarios**:

1. **Given** the target repo cannot be cloned, **When** the workflow fails at setup, **Then** the callback reports FAILED with error code `DISPATCH_FAILED`
2. **Given** the detection script encounters an error, **When** Phase 1 fails, **Then** the callback reports FAILED with error code `CONFIG_GENERATION_FAILED`
3. **Given** all files are generated but the git push fails, **When** the commit step errors, **Then** the callback reports FAILED with error code `COMMIT_FAILED`

### Edge Cases

- What happens when the target repository is empty (no code, just initialized)? Detection script produces a minimal config with no language/framework detected; Phase 2 generates minimal guidance.
- What happens when the repository has multiple languages (e.g., TypeScript frontend + Python backend)? Detection script identifies the primary language (most code/manifest at root level) and lists secondary languages in analysis.json for Phase 2 context.
- What happens when the owner's AI credential has expired or is invalid? Workflow reports FAILED before Phase 2 with appropriate error; Phase 1 outputs are still committed if already generated.
- What happens when the repository has branch protection rules? Git push fails; callback reports `COMMIT_FAILED` with a message explaining the likely cause.
- What happens when the workflow is cancelled mid-execution? Standard GitHub Actions cancellation; any in-progress step is terminated and callback reports FAILED.

## Requirements

### Functional Requirements

- **FR-001**: System MUST execute a deterministic detection phase (Phase 1) that produces a valid `.ai-board/config.yml` by scanning repository manifest files, lockfiles, and configuration patterns
- **FR-002**: System MUST detect languages from manifest files: `package.json` (JS/TS), `Cargo.toml` (Rust), `go.mod` (Go), `pyproject.toml` (Python), `pom.xml`/`build.gradle` (Java/Kotlin), `Gemfile` (Ruby), `composer.json` (PHP)
- **FR-003**: System MUST detect package managers from lockfiles: `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`, `Cargo.lock`, `poetry.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`
- **FR-004**: System MUST detect frameworks from dependency declarations in their respective manifest files (e.g., Next.js from package.json dependencies, Django from pyproject.toml, Rails from Gemfile)
- **FR-005**: System MUST detect services from `docker-compose.yml` service definitions and ORM configuration files (e.g., Prisma schema referencing PostgreSQL)
- **FR-006**: System MUST extract available commands from `package.json` scripts, `Makefile` targets, `Taskfile` tasks, and `pyproject.toml` scripts
- **FR-007**: System MUST detect test frameworks from configuration files and dependencies (vitest, jest, pytest, playwright, rspec, phpunit, cargo test, go test)
- **FR-008**: System MUST produce an `analysis.json` structured summary of all detection results for use as context in Phase 2
- **FR-009**: System MUST execute an LLM-powered generation phase (Phase 2) that reads the codebase and produces project-specific `CLAUDE.md` and `constitution.md` files
- **FR-010**: System MUST preserve existing `CLAUDE.md` files — Phase 2 skips generation if the file already exists
- **FR-011**: System MUST create an `AGENTS.md` symlink pointing to `CLAUDE.md`
- **FR-012**: System MUST commit all generated files in a single atomic commit to the target repository's default branch
- **FR-013**: System MUST report status via callback API at each transition: RUNNING at start, COMPLETED or FAILED at end
- **FR-014**: System MUST support partial success — if Phase 2 fails, Phase 1 outputs are committed and callback reports `partial: true` with a summary of files created vs missing
- **FR-015**: System MUST report structured error codes in callback payload: `DISPATCH_FAILED`, `CONFIG_GENERATION_FAILED`, `GUIDANCE_GENERATION_FAILED`, `COMMIT_FAILED`
- **FR-016**: Generated `config.yml` MUST pass the existing config schema validation
- **FR-017**: Generated `CLAUDE.md` MUST contain project-specific content derived from actual code analysis, not generic templates
- **FR-018**: Generated `constitution.md` MUST contain principles derived from observed code patterns and conventions, plus universal governance standards

### Key Entities

- **Analysis Result**: Structured detection output containing detected language, package manager, framework, services, commands, and test framework — serialized as `analysis.json`
- **Artifact Summary**: Record of files created, preserved, or missing during onboarding — stored in `ProjectSetupJob.artifactSummary` JSON field
- **Config File**: `.ai-board/config.yml` — structured project configuration that passes schema validation and drives AI Board's understanding of the project

### Internal Processes

- **Stack Detection (Phase 1)**: Triggered by onboard workflow dispatch. Receives cloned target repository path as input.
  - **Input**: Target repository filesystem (full clone of default branch)
  - **Phases**:
    1. Scan for manifest files (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`)
    2. Identify lockfiles to determine package manager
    3. Parse dependency declarations for framework detection
    4. Scan for service configurations (`docker-compose.yml`, ORM configs)
    5. Extract available commands from build/task files
    6. Detect test framework from config files and dependencies
    7. Generate `.ai-board/config.yml` from detection results
    8. Generate `analysis.json` summary for Phase 2 context
  - **Output**: `config.yml` (validated against schema) and `analysis.json` (structured detection context)
  - **Error behavior**: If detection fails, workflow reports `CONFIG_GENERATION_FAILED` and exits — no files committed

- **LLM Content Generation (Phase 2)**: Triggered after successful Phase 1 completion. Receives `analysis.json` and full codebase access.
  - **Input**: `analysis.json` from Phase 1, full target repository filesystem
  - **Phases**:
    1. Read `analysis.json` to understand detected stack
    2. Browse actual codebase to understand architecture, patterns, and conventions
    3. Generate `CLAUDE.md` with project-specific tech stack details, commands, data models, testing patterns, and architecture description (skipped if file exists)
    4. Generate `.ai-board/memory/constitution.md` with principles derived from observed code patterns plus universal governance standards
    5. Create `AGENTS.md` symlink pointing to `CLAUDE.md`
  - **Output**: `CLAUDE.md`, `.ai-board/memory/constitution.md`, `AGENTS.md` symlink
  - **Error behavior**: On failure, Phase 1 outputs are still committed (partial success); callback includes `GUIDANCE_GENERATION_FAILED` error code and `partial: true` flag

- **Commit and Callback**: Triggered after Phase 1 (partial) or Phase 2 (full) completion.
  - **Input**: Generated files in target repo working directory
  - **Phases**:
    1. Stage all generated/modified files
    2. Create single atomic commit: `chore: initialize ai-board configuration`
    3. Push to default branch
    4. Report COMPLETED via callback with artifact summary and commit SHA
  - **Output**: Git commit on default branch, callback with artifact summary
  - **Error behavior**: If push fails, callback reports `COMMIT_FAILED`; if callback itself fails, workflow logs error but does not retry

## Success Criteria

### Measurable Outcomes

- **SC-001**: Onboarding workflow completes end-to-end in under 3 minutes for typical repositories (Phase 1 under 30 seconds, Phase 2 under 2.5 minutes)
- **SC-002**: Detection script produces valid, schema-compliant configuration for repositories across all 7 supported language ecosystems (TypeScript/JavaScript, Python, Rust, Go, Java/Kotlin, Ruby, PHP)
- **SC-003**: Generated guidance files (CLAUDE.md, constitution.md) contain project-specific references to actual code patterns, not generic boilerplate — reviewers can identify which project the files describe without seeing the repo name
- **SC-004**: Partial success path preserves Phase 1 outputs when Phase 2 fails, ensuring the project is minimally functional (config synced) in 100% of Phase 2 failure cases
- **SC-005**: All error conditions produce structured error codes in the callback payload, enabling the setup page to display actionable guidance for every failure type
- **SC-006**: Re-onboarding a previously onboarded project preserves existing CLAUDE.md customizations while refreshing the deterministic configuration
