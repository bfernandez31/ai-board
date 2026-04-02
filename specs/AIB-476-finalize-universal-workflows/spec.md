# Feature Specification: Finalize Universal Workflows — run-command.sh + Conditional Services

**Feature Branch**: `AIB-476-finalize-universal-workflows`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Finalize universal workflows: run-command.sh + conditional services"

## Auto-Resolved Decisions

### Decision 1: Backward-compatibility strategy when config.yml is missing

- **Decision**: When `.ai-board/config.yml` is absent, `run-command.sh` silently skips (exit 0). AI-board itself always has config.yml so its workflows are unaffected. External repos without config get graceful no-ops.
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (score 3) — internal infrastructure with clear intent to ship; no compliance or security implications
- **Fallback Triggered?**: No — AUTO resolved to PRAGMATIC with sufficient confidence (0.6)
- **Trade-offs**:
  1. External repos without config will silently skip commands rather than fail — acceptable since those repos are not yet onboarded
  2. No migration path needed for existing ai-board workflows; they already have config.yml
- **Reviewer Notes**: Verify that silent skip behavior for missing config is documented in run-command.sh header comments so future maintainers understand the design choice

### Decision 2: Service input scope — which services to support initially

- **Decision**: Support postgres, redis, mysql, and mongo as conditional service inputs across all workflows. Only postgres is actively used by ai-board today; the others are declared but dormant (empty image strings mean no overhead).
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (score 3) — the ticket explicitly lists all four services; supporting all four now avoids a follow-up ticket
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more verbose workflow YAML inputs, but no runtime cost for unused services
  2. Pre-declares infrastructure that may never be used by some projects
- **Reviewer Notes**: Confirm that unused service inputs (redis, mysql, mongo) truly have zero overhead when their `needs_*` flag is false

### Decision 3: Scope of hardcoded command replacement

- **Decision**: Replace hardcoded project commands (`bun install`, `bun run test:unit`, `npx playwright test`) with `run-command.sh` calls. Prisma-specific commands (`npx prisma generate`, `npx prisma migrate deploy`, `npx tsx tests/global-setup.ts`) and Playwright browser install commands remain hardcoded because they are infrastructure setup steps, not project commands.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score 5) — clear distinction between project commands (configurable) and infrastructure provisioning (workflow responsibility)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prisma/Playwright setup commands stay coupled to workflow definitions, but these are already guarded by HAS_PRISMA/HAS_PLAYWRIGHT detection
  2. A future iteration could add config keys for these, but that's unnecessary scope for this ticket
- **Reviewer Notes**: Validate that the Prisma/Playwright distinction is correct by checking whether any external project would need different setup commands for these tools

### Decision 4: setup-environment.sh integration approach

- **Decision**: Do NOT replace existing workflow steps with a single unconditional `setup-environment.sh` call (the approach that failed in AIB-468). Instead, workflows call `setup-environment.sh` with a phase parameter controlling which setup tiers execute: lightweight (symlinks + runtime) for specify/plan, full (+ deps, Prisma, Playwright) for implement/build/verify/health-scan.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (score 5) — directly addresses the AIB-468 failure mode; preserves existing phase-aware intelligence
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Requires modifying setup-environment.sh to accept a phase parameter, but avoids the unconditional execution that broke AIB-468
  2. Workflows still have some setup logic (service definitions, phase conditionals) rather than being fully delegated to the script
- **Reviewer Notes**: Confirm the phase parameter naming is clear and matches the mental model of workflow maintainers

## User Scenarios & Testing

### User Story 1 — External Project Runs Build Workflow with Custom Stack (Priority: P1)

A project owner onboards an external repository (e.g., a Python/Django project) to ai-board. The project's `.ai-board/config.yml` defines custom commands (`pip install -r requirements.txt` for install, `pytest` for test_unit). When a ticket transitions to BUILD, the workflow reads commands from config and executes them instead of hardcoded bun/node commands.

**Why this priority**: This is the core value proposition — without it, external projects with non-bun stacks cannot use ai-board workflows at all.

**Independent Test**: Can be tested by creating a mock config.yml with custom commands and verifying run-command.sh executes the correct command for each key.

**Acceptance Scenarios**:

1. **Given** a target repo with `.ai-board/config.yml` defining `commands.install: pip install -r requirements.txt`, **When** the workflow runs the install step, **Then** `pip install -r requirements.txt` is executed in the target directory
2. **Given** a target repo with `.ai-board/config.yml` defining `commands.test_unit: pytest tests/`, **When** the workflow runs unit tests, **Then** `pytest tests/` is executed and its exit code is propagated
3. **Given** a target repo with `.ai-board/config.yml` that does NOT define `commands.test_e2e`, **When** the workflow attempts to run E2E tests, **Then** the step silently succeeds (exit 0) without error

---

### User Story 2 — AI-Board Self-Management Continues Working (Priority: P1)

AI-board manages itself. After the workflow changes, all existing ai-board workflows (speckit, quick-impl, verify, health-scan, iterate, assist) continue to pass without modification to ai-board's own `.ai-board/config.yml`.

**Why this priority**: Equal priority with Story 1 — regression in self-management would block all development.

**Independent Test**: Run the existing workflow suite against ai-board itself and verify all steps complete successfully.

**Acceptance Scenarios**:

1. **Given** ai-board's existing `.ai-board/config.yml` with bun-based commands, **When** speckit.yml runs with command=implement, **Then** deps install, Prisma setup, and Playwright setup all complete as before
2. **Given** ai-board's existing config, **When** speckit.yml runs with command=specify, **Then** only lightweight setup executes; no dep install, no Prisma, no Playwright
3. **Given** ai-board's existing config, **When** verify.yml runs, **Then** unit tests and E2E tests execute using commands from config.yml

---

### User Story 3 — Workflow with Conditional Database Service (Priority: P2)

A project requires PostgreSQL for testing but not Redis. The workflow inputs declare `needs_postgres: true` and `needs_redis: false`. Only the PostgreSQL service container starts; no Redis container is provisioned.

**Why this priority**: Conditional services enable external projects with different infrastructure needs while avoiding unnecessary resource consumption.

**Independent Test**: Can be tested by inspecting workflow service definitions and confirming containers only start when their `needs_*` input is true.

**Acceptance Scenarios**:

1. **Given** a workflow dispatch with `needs_postgres: true` and `postgres_version: '14'`, **When** the job starts, **Then** a PostgreSQL 14 container is running and healthy on port 5432
2. **Given** a workflow dispatch with `needs_redis: false`, **When** the job starts, **Then** no Redis container is provisioned
3. **Given** a workflow dispatch with `needs_postgres: false`, **When** the job runs database-dependent steps, **Then** those steps are skipped gracefully

---

### User Story 4 — Lightweight Phase Skips Heavy Setup (Priority: P2)

When a specify or plan command runs, only lightweight setup (symlinks, runtime tools) executes. Dependencies are not installed, Prisma is not configured, and Playwright browsers are not downloaded — preserving current performance.

**Why this priority**: Preserves the existing phase-aware optimization that prevents unnecessary setup for non-code-execution phases.

**Independent Test**: Run speckit.yml with command=specify and verify that install/Prisma/Playwright steps are not executed.

**Acceptance Scenarios**:

1. **Given** speckit.yml running with `command=specify`, **When** setup executes, **Then** only symlinks and runtime setup run (lightweight phase)
2. **Given** speckit.yml running with `command=implement`, **When** setup executes, **Then** full setup runs including dependency install, Prisma, and Playwright
3. **Given** ai-board-assist.yml running, **When** setup executes, **Then** only lightweight setup runs (no deps, no Prisma, no Playwright)

---

### User Story 5 — Backward Compatibility for Repos Without Config (Priority: P3)

A repository that has not yet created `.ai-board/config.yml` triggers a workflow. The workflow detects the missing config and silently skips configurable commands without failing.

**Why this priority**: Ensures no breaking changes during the transition period as projects adopt config-driven commands.

**Independent Test**: Remove or rename config.yml in a test environment and verify workflows complete without errors.

**Acceptance Scenarios**:

1. **Given** a target repo without `.ai-board/config.yml`, **When** `run-command.sh` is called with key `install`, **Then** the script exits 0 (silent skip) without error
2. **Given** a target repo without `.ai-board/config.yml`, **When** `setup-environment.sh` runs, **Then** it falls back to default behavior without failing

### Edge Cases

- What happens when `config.yml` exists but a specific command key is missing? The system silently skips that command (exit 0).
- What happens when a command in config.yml fails (non-zero exit)? The exit code is faithfully propagated, causing the workflow step to fail as expected.
- What happens when `config.yml` has invalid YAML syntax? The script fails with a clear error message indicating the parse failure.
- What happens when a service is requested but the version image doesn't exist? The workflow fails at container startup with a Docker pull error — standard GitHub Actions behavior.
- What happens when `setup-environment.sh` is called with an unrecognized phase parameter? The script fails with a usage error rather than executing partial setup.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a `run-command.sh` script at `.github/scripts/run-command.sh` that accepts a target directory and command key, reads the corresponding command from `.ai-board/config.yml`, and executes it in the target directory
- **FR-002**: `run-command.sh` MUST silently exit with code 0 when the requested command key is not defined in config or when config.yml is absent
- **FR-003**: `run-command.sh` MUST faithfully return the executed command's exit code when a command is defined and runs
- **FR-004**: `run-command.sh` MUST support these command keys: `install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`
- **FR-005**: All workflow YAML files MUST replace hardcoded project commands (`bun install --frozen-lockfile`, `bun run test:unit`, `npx playwright test`, etc.) with `run-command.sh` calls using the appropriate command key
- **FR-006**: All workflow YAML files that execute tests MUST accept boolean inputs for each supported service: `needs_postgres`, `needs_redis`, `needs_mysql`, `needs_mongo`
- **FR-007**: All workflow YAML files that accept service inputs MUST also accept version inputs: `postgres_version`, `redis_version`, `mysql_version`, `mongo_version`
- **FR-008**: Service containers MUST only start when their corresponding `needs_*` input is true; when false, no container is provisioned (zero overhead)
- **FR-009**: `setup-environment.sh` integration MUST be phase-aware: lightweight setup (symlinks, runtime) for specify/plan phases; full setup (deps, Prisma, Playwright) for implement/build/verify/health-scan phases
- **FR-010**: All script references in workflows MUST use workspace-root-relative paths with `ai-board/` prefix (NOT `../ai-board/`)
- **FR-011**: The existing execution order MUST be preserved: symlinks, runtime, deps, dependency detection, Prisma, Playwright
- **FR-012**: Bun cache step MUST be preserved in workflows where it currently exists (speckit.yml)
- **FR-013**: System MUST maintain backward compatibility — workflows MUST function correctly when `.ai-board/config.yml` is absent in the target repository

### Key Entities

- **config.yml**: Project configuration file (`.ai-board/config.yml`) defining project metadata, runtime versions, commands, and environment variables. Source of truth for project-specific command mappings.
- **run-command.sh**: Centralized command execution script that bridges workflow steps to project-specific commands via config.yml lookups.
- **setup-environment.sh**: Existing environment setup script that handles runtime installation, symlinks, dependency detection, and agent CLI setup. To be enhanced with phase-aware execution.
- **Workflow YAML**: GitHub Actions workflow definitions (speckit, quick-impl, verify, ai-board-assist, iterate, health-scan) that orchestrate CI/CD pipelines.
- **Service Container**: Docker containers (PostgreSQL, Redis, MySQL, MongoDB) provisioned by GitHub Actions as job services, conditionally enabled via workflow inputs.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All six workflow files use `run-command.sh` for project commands instead of hardcoded commands — zero hardcoded `bun run`, `npx`, or `bunx` project commands remain
- **SC-002**: An external project with a non-bun stack can execute the full build workflow by only providing `.ai-board/config.yml` with appropriate command mappings
- **SC-003**: Specify and plan phases complete without installing dependencies, running Prisma, or downloading Playwright browsers — maintaining current performance characteristics
- **SC-004**: All existing ai-board workflows continue to pass without modifications to ai-board's own config.yml
- **SC-005**: Service containers are only provisioned when explicitly requested, adding zero overhead to workflows that don't need them
- **SC-006**: Workflows with missing `.ai-board/config.yml` in the target repo complete without errors

## Assumptions

- External projects will adopt `.ai-board/config.yml` progressively; there is no hard migration deadline
- The existing `.ai-board/config.yml` schema (version 1) is sufficient for the command keys needed
- Prisma and Playwright infrastructure setup commands remain workflow-managed (not config-driven) because they are provisioning steps, not project commands
- The `run-command.sh` script will use standard bash available in GitHub Actions runners
- Service container images are pulled from Docker Hub using standard naming conventions (e.g., `postgres:14`, `redis:7`)
