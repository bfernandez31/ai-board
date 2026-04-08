# Feature Specification: Project Onboarding — Setup Page + Hybrid Workflow

**Feature Branch**: `AIB-572-project-onboarding-setup`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Project onboarding: setup page + hybrid workflow"

## Auto-Resolved Decisions

### Decision 1: SetupJob as Dedicated Model vs. Reusing HealthScan

- **Decision**: Create a dedicated `SetupJob` model rather than reusing or extending the `HealthScan` model
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — SetupJob has fundamentally different semantics (project-scoped onboarding vs. recurring health scans), and conflating them would create confusing query patterns and lifecycle mismatches
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adds a new database table and migration, slightly increasing schema complexity
  2. Clean separation of concerns; avoids overloading HealthScan with unrelated state
- **Reviewer Notes**: Confirm that one SetupJob per project is sufficient (no need for historical onboarding attempts beyond the latest)

### Decision 2: Language/Framework Enum Extension for Multi-Stack Support

- **Decision**: Extend configuration validation to support Ruby, PHP, and their frameworks (Rails, Laravel) and package managers (bundler, composer) — currently only TypeScript, JavaScript, Python, Go, Rust, Java, and Kotlin are supported
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — the ticket explicitly requires multi-stack detection for at least 7 language families; the existing enum is a known gap
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Broader language support increases detection script complexity and test surface
  2. Enables onboarding for a wider range of external repositories, which is the core value proposition
- **Reviewer Notes**: Validate that adding enum values to the config schema doesn't break existing projects with already-synced configs

### Decision 3: Partial Success Handling When Phase 2 Fails

- **Decision**: If Phase 1 (deterministic detection) succeeds but Phase 2 (LLM generation) fails, commit only the Phase 1 outputs (`config.yml`) and mark the setup job as COMPLETED with a warning flag, rather than marking the entire onboarding as FAILED
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — partial success is explicitly mentioned in the ticket as desirable ("If the LLM phase fails, we still have config.yml from Phase 1"), but the user experience of a partially-onboarded project needs careful handling
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users get a functional project (config synced) even if LLM content generation fails, reducing friction
  2. The project will lack `CLAUDE.md` and `constitution.md`, which may cause confusion in later workflow stages; clear messaging is needed
- **Reviewer Notes**: Determine whether a partially-onboarded project should show a banner or re-entry point to regenerate the missing LLM-generated files

### Decision 4: Onboard Workflow Commits Directly to Default Branch

- **Decision**: The onboard workflow commits generated configuration files directly to the repository's default branch (not via a PR)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — the ticket specifies "single atomic commit of all generated files to default branch"; this is the standard pattern for initial project scaffolding
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Direct commit is simpler and avoids requiring the user to merge a PR before the project becomes operational
  2. If the repository has branch protection rules, the workflow must use elevated permissions (consistent with existing workflow patterns)
- **Reviewer Notes**: Ensure the workflow token has write access to the default branch; document that branch protection may need a bypass rule for the bot account

### Decision 5: Credential Check is Real-Time, Not Cached

- **Decision**: The setup page verifies credential availability via a live check each time the user changes agent selection, rather than caching credential status on page load
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — credentials can be added/revoked at any time; stale credential checks could lead to workflow dispatch failures
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Additional request per agent selection change (minimal latency impact)
  2. Prevents dispatch failures due to stale credential state
- **Reviewer Notes**: Consider debouncing the check if radio button toggling causes excessive requests

## User Scenarios & Testing

### User Story 1 - Complete Onboarding of an Imported Repository (Priority: P1)

A project owner imports an external GitHub repository that has no AI Board configuration. They are redirected to a setup page where they select their preferred agent CLI, verify credentials are available, and initiate the onboarding workflow. The workflow detects the project's technology stack and generates configuration files. Upon completion, the owner is redirected to the project board where all workflow stages are now operational.

**Why this priority**: This is the core value of the feature — without it, imported projects are stuck in a dead-end state with a 404 error. Every other story depends on this flow working end-to-end.

**Independent Test**: Can be fully tested by importing a repository without `.ai-board/config.yml`, completing the setup flow, and verifying the project board loads with valid configuration.

**Acceptance Scenarios**:

1. **Given** a project owner has just imported a repository without `.ai-board/config.yml`, **When** the import completes, **Then** the owner is redirected to `/projects/{id}/setup` and sees the setup page with agent selection options
2. **Given** the owner is on the setup page and has a valid credential for their selected agent, **When** they click "Initialize Project", **Then** a setup job is created with PENDING status and the onboarding workflow is dispatched
3. **Given** the onboarding workflow has completed successfully, **When** the setup page polls for status, **Then** the page shows a success state with the list of committed files and a button to navigate to the project board
4. **Given** the onboarding workflow has completed, **When** the owner navigates to the project board, **Then** the project's configuration is synced from the committed `config.yml` and all workflow stages are available

---

### User Story 2 - Setup Page Guards and State Recovery (Priority: P2)

The setup page enforces access controls and handles various entry states: only project owners can access it, projects with existing configuration are redirected away, and in-progress onboarding is displayed correctly even after page refresh.

**Why this priority**: Guards prevent duplicate workflows, unauthorized access, and confusion — essential for reliability but not the primary user journey.

**Independent Test**: Can be tested by accessing the setup page under various conditions (non-owner, existing config, running job) and verifying correct behavior.

**Acceptance Scenarios**:

1. **Given** a non-owner member navigates to `/projects/{id}/setup`, **When** the page loads, **Then** they are denied access with an appropriate message
2. **Given** a project already has a synced configuration, **When** the owner navigates to `/projects/{id}/setup`, **Then** they are automatically redirected to the project board
3. **Given** an onboarding workflow is currently running, **When** the owner refreshes the setup page, **Then** they see the running state with elapsed time (not the initial selection state)
4. **Given** a setup job is already PENDING or RUNNING, **When** the owner attempts to dispatch another onboarding workflow, **Then** the request is rejected with a message indicating onboarding is already in progress

---

### User Story 3 - Credential Validation Before Dispatch (Priority: P2)

Before allowing the owner to initiate onboarding, the setup page verifies that a credential is configured for the chosen agent CLI. If no credential exists, the page blocks dispatch and provides guidance on how to add one.

**Why this priority**: Prevents wasted workflow runs that would immediately fail due to missing credentials — a common user frustration point.

**Independent Test**: Can be tested by selecting an agent CLI with and without a configured credential and verifying the button state and guidance messages.

**Acceptance Scenarios**:

1. **Given** the owner selects "Claude Code" and has an Anthropic credential configured, **When** the credential check completes, **Then** the "Initialize Project" button becomes enabled
2. **Given** the owner selects "Codex" and has no OpenAI credential configured, **When** the credential check completes, **Then** the "Initialize Project" button remains disabled and guidance is shown on how to add an OpenAI credential
3. **Given** the owner switches agent selection from Claude Code to Codex, **When** the selection changes, **Then** a new credential check is performed for the newly selected agent's provider

---

### User Story 4 - Deterministic Stack Detection (Priority: P1)

The onboarding workflow's first phase scans the repository for known manifest files, lockfiles, and configuration patterns to produce a valid `config.yml` reflecting the project's technology stack, and an `analysis.json` summary for the LLM phase.

**Why this priority**: This phase produces the `config.yml` that makes the project operational — it must work reliably across all supported language ecosystems.

**Independent Test**: Can be tested by running the detection script against repositories with known technology stacks and validating the generated `config.yml` against the configuration schema.

**Acceptance Scenarios**:

1. **Given** a repository contains `package.json` with a Next.js dependency and `bun.lockb`, **When** Phase 1 runs, **Then** the generated `config.yml` specifies TypeScript, Next.js framework, and Bun package manager
2. **Given** a repository contains `Cargo.toml` with Actix-web dependency, **When** Phase 1 runs, **Then** the generated `config.yml` specifies Rust, Actix framework, and Cargo package manager
3. **Given** a repository contains `pyproject.toml` with FastAPI and a `docker-compose.yml` with PostgreSQL, **When** Phase 1 runs, **Then** the generated `config.yml` specifies Python, FastAPI framework, and includes PostgreSQL as a service
4. **Given** a repository contains `Gemfile` with Rails, **When** Phase 1 runs, **Then** the generated `config.yml` specifies Ruby, Rails framework, and Bundler package manager
5. **Given** any generated `config.yml`, **When** validated against the configuration schema, **Then** it passes validation without errors

---

### User Story 5 - LLM-Powered Content Generation (Priority: P2)

The onboarding workflow's second phase uses an AI agent to browse the codebase and generate intelligent, project-specific `CLAUDE.md` and `constitution.md` files that reflect actual code conventions rather than generic templates.

**Why this priority**: Adds significant quality to the onboarding output but the project is functional without it (config.yml from Phase 1 is sufficient for basic operation).

**Independent Test**: Can be tested by running the agent command against a known codebase and evaluating the generated files for project-specific content.

**Acceptance Scenarios**:

1. **Given** Phase 1 produced `analysis.json` for a TypeScript/Next.js project, **When** Phase 2 runs, **Then** the generated `CLAUDE.md` includes sections for tech stack, commands, data models (if applicable), testing patterns, and architecture
2. **Given** Phase 1 completed and the repository already has a `CLAUDE.md`, **When** Phase 2 runs, **Then** the existing `CLAUDE.md` is preserved (not overwritten)
3. **Given** Phase 2 completes successfully, **When** the output is examined, **Then** an `AGENTS.md` symlink exists pointing to `CLAUDE.md`
4. **Given** Phase 2 completes successfully, **When** `constitution.md` is examined, **Then** it contains principles derived from observed code patterns (not just generic governance boilerplate)

---

### User Story 6 - Error Recovery and Retry (Priority: P3)

When the onboarding workflow fails, the setup page displays the error and allows the owner to retry the entire process from scratch.

**Why this priority**: Error recovery is important for robustness but is an exceptional flow, not the primary path.

**Independent Test**: Can be tested by simulating a workflow failure and verifying the error state UI and retry behavior.

**Acceptance Scenarios**:

1. **Given** the onboarding workflow has failed, **When** the setup page polls for status, **Then** the page shows an error message with details about what went wrong
2. **Given** the setup page is showing an error state, **When** the owner clicks "Retry", **Then** a new setup job is created and the onboarding workflow is dispatched from scratch
3. **Given** Phase 1 succeeds but Phase 2 fails, **When** the workflow completes, **Then** the Phase 1 outputs are committed, the project receives a partial configuration, and the setup page indicates which files were generated and which were not

---

### Edge Cases

- What happens when the repository has no recognizable manifest files (unknown stack)? The detection script produces a minimal `config.yml` with sensible defaults and the LLM phase attempts to infer the stack from source files.
- What happens when the repository is empty or contains only a README? Phase 1 produces a minimal config; Phase 2 may generate sparse `CLAUDE.md` content reflecting the limited codebase.
- What happens when the owner's GitHub token lacks write access to the default branch? The workflow fails at the commit step; the error is surfaced on the setup page with guidance to check repository permissions.
- What happens when the owner revokes their agent credential after dispatch but before the workflow uses it? The workflow fails during agent setup; treated as a standard workflow failure with retry available.
- What happens when two browser tabs attempt to dispatch simultaneously? The duplicate dispatch guard (reject when PENDING or RUNNING) prevents the second request.
- What happens when `.ai-board/` is already in `.gitignore`? The workflow detects this and skips the `.gitignore` modification (idempotent).

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a functional setup page at `/projects/{id}/setup` for projects without synced configuration
- **FR-002**: Setup page MUST present agent CLI selection with two options: Claude Code and Codex
- **FR-003**: System MUST verify credential availability for the selected agent's provider before allowing workflow dispatch
- **FR-004**: System MUST block the "Initialize Project" action and display credential guidance when no matching credential exists
- **FR-005**: System MUST create a setup job record and dispatch the onboarding workflow when the owner initiates setup
- **FR-006**: System MUST prevent duplicate workflow dispatch when a setup job is already PENDING or RUNNING
- **FR-007**: Setup page MUST poll for setup job status and reflect current state (pending, running, completed, failed)
- **FR-008**: System MUST redirect the owner to the project board upon successful onboarding completion
- **FR-009**: System MUST restrict setup page access to project owners only
- **FR-010**: System MUST automatically redirect to the project board when the project already has synced configuration
- **FR-011**: System MUST preserve the running state across page refreshes (resume polling, not reset to initial state)
- **FR-012**: The deterministic detection phase MUST identify language, package manager, framework, services, commands, and test framework from repository manifest files and lockfiles
- **FR-013**: The deterministic detection phase MUST produce a `config.yml` that passes the project configuration schema validation
- **FR-014**: The deterministic detection phase MUST support detection for at least: TypeScript/JavaScript, Python, Rust, Go, Java/Kotlin, Ruby, and PHP ecosystems
- **FR-015**: The LLM generation phase MUST produce a `CLAUDE.md` with project-specific content including tech stack, commands, data models, testing patterns, and architecture
- **FR-016**: The LLM generation phase MUST preserve existing `CLAUDE.md` files (skip generation if already present)
- **FR-017**: The LLM generation phase MUST produce a `constitution.md` with principles derived from observed code patterns
- **FR-018**: The LLM generation phase MUST create an `AGENTS.md` symlink pointing to `CLAUDE.md`
- **FR-019**: All generated files MUST be committed in a single atomic commit to the default branch
- **FR-020**: The onboarding workflow MUST add `.ai-board/` to `.gitignore` if not already present
- **FR-021**: System MUST trigger configuration sync to the database after the workflow commits files
- **FR-022**: System MUST allow retry from the error state, dispatching a fresh workflow run
- **FR-023**: The onboarding workflow MUST be lightweight: no runtime setup, no service provisioning, no dependency installation
- **FR-024**: If Phase 1 succeeds but Phase 2 fails, the system MUST commit Phase 1 outputs and report partial completion with clear indication of what was and was not generated

### Key Entities

- **SetupJob**: Tracks the state of a project's onboarding workflow. Key attributes: associated project, selected agent CLI, current status (pending/running/completed/failed), timing information (started, completed, duration), error details if failed, and whether completion was partial (Phase 1 only) or full. One active setup job per project at a time.
- **Project** (extended): Gains a relationship to SetupJob for tracking onboarding state. The existing `config` JSON field and `configSyncedAt` timestamp are populated upon successful onboarding completion.

### Internal Processes

- **Onboard Workflow** (`onboard.yml`): Triggered by the setup page when the owner clicks "Initialize Project". Receives project ID, repository identifier, selected agent CLI, and callback information.
  - **Input**: Project ID, GitHub repository (owner/repo format), selected agent CLI (Claude Code or Codex), owner credential (encrypted), callback URL for status updates
  - **Phases**:
    1. **Repository Preparation**: Sparse checkout of the AI Board repository (plugin scripts only) and full clone of the target repository's default branch
    2. **Agent CLI Setup**: Install and configure the selected agent CLI tool
    3. **Phase 1 — Deterministic Detection**: Run a shell script that scans the target repository for manifest files, lockfiles, and configuration patterns. Produces two artifacts: `config.yml` (structured project configuration) and `analysis.json` (detection summary for the LLM)
    4. **Phase 2 — LLM Content Generation**: Execute an agent command that receives `analysis.json` as context, browses the target repository, and generates `CLAUDE.md` (project-specific development guidelines), `constitution.md` (governance principles derived from code), and `AGENTS.md` (symlink to `CLAUDE.md`). Skips `CLAUDE.md` generation if the file already exists.
    5. **Commit and Push**: Stage all generated files plus `.gitignore` update into a single atomic commit on the default branch
    6. **Status Callback**: Notify the application of workflow completion (or failure), triggering database updates and configuration sync
  - **Output**: Configuration files committed to the repository (`.ai-board/config.yml`, `CLAUDE.md`, `AGENTS.md`, `.ai-board/memory/constitution.md`), updated `.gitignore`, synced project configuration in the database
  - **Error behavior**: If Phase 1 fails, the entire workflow fails and no files are committed. If Phase 2 fails, Phase 1 outputs are committed (partial success). In all cases, the setup job status is updated via callback with error details. The workflow is retryable from scratch — each run is idempotent (existing files are preserved, not overwritten).

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of imported projects without configuration land on a functional setup page (zero 404 errors on the setup route)
- **SC-002**: Users complete the entire onboarding flow (from setup page to project board) in under 5 minutes
- **SC-003**: Phase 1 deterministic detection produces a valid, schema-compliant `config.yml` for repositories using any of the 7 supported language ecosystems
- **SC-004**: Phase 2 LLM generation produces `CLAUDE.md` content that references at least 3 project-specific details (actual command names, framework patterns, or architecture conventions) rather than generic placeholders
- **SC-005**: Retry from error state successfully recovers and completes onboarding without requiring manual intervention
- **SC-006**: Setup page correctly reflects workflow state across page refreshes with no stale or inconsistent status displayed
- **SC-007**: Zero duplicate workflow dispatches occur for the same project (guard enforcement rate of 100%)

## Assumptions

- The onboarding workflow has sufficient GitHub token permissions to commit directly to the target repository's default branch (including repositories with branch protection rules that allow the bot account)
- The deterministic detection script covers the most common project structures for each language ecosystem; unusual or non-standard layouts may produce incomplete `config.yml` that still passes validation
- The LLM phase's quality depends on the target repository having readable source code; obfuscated or generated code may yield lower-quality `CLAUDE.md` content
- A single setup job per project is sufficient; historical onboarding attempts beyond the latest are not needed for the initial implementation
- The owner's agent credential remains valid between dispatch and workflow execution (typically seconds to minutes)
