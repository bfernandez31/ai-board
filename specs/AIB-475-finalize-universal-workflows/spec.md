# Feature Specification: Finalize Universal Workflows — run-command.sh + Conditional Services

**Feature Branch**: `AIB-475-finalize-universal-workflows`
**Created**: 2026-04-01
**Status**: Draft
**Input**: Ticket AIB-475 — Finalize universal workflows: run-command.sh + conditional services

## Auto-Resolved Decisions

### Decision 1: Backward Compatibility Strategy

- **Decision**: When `.ai-board/config.yml` is missing from a target repository, workflows fall back to their current hardcoded defaults rather than failing. The `run-command.sh` script checks for config presence and uses inline fallback values matching the existing ai-board commands.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1, absScore: 1). Context signals: neutral infrastructure feature (+1), internal CI/CD tooling (-2). Confidence 0.3, below 0.5 threshold.
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5, promoted to CONSERVATIVE. Conservative approach preserves existing behavior as the safe default.
- **Trade-offs**:
  1. Increases script complexity with fallback logic, but guarantees zero breakage for existing repos
  2. External repos without config files continue working with ai-board's own defaults until they add their own config
- **Reviewer Notes**: Verify that fallback defaults match current hardcoded values exactly. Future work should emit a deprecation warning when fallback is used, encouraging repos to add `.ai-board/config.yml`.

### Decision 2: Service Container Activation Model

- **Decision**: Workflows accept `needs_<service>` boolean inputs paired with `<service>_version` string inputs. Services are declared statically in the YAML but use conditional image strings — when `needs_<service>` is false, the image resolves to an empty string and the container does not start.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1). Same signal analysis as Decision 1.
- **Fallback Triggered?**: Yes — conservative approach selected to ensure zero resource waste and no unintended side effects from idle containers.
- **Trade-offs**:
  1. Requires all callers (the ai-board app) to pass service inputs on dispatch, adding dispatch-side complexity
  2. Avoids any runtime overhead from unused containers; workflows remain declarative and auditable
- **Reviewer Notes**: Confirm GitHub Actions behavior with `image: ''` — the container definition must be present but the empty image string must result in no container being started. Test with at least one workflow that currently has no services.

### Decision 3: Command Key Naming Convention

- **Decision**: The `run-command.sh` script uses underscore-separated command keys matching the `.ai-board/config.yml` schema: `install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`. These keys are stable identifiers — workflows reference them, not the underlying shell commands.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1). Same signal analysis.
- **Fallback Triggered?**: Yes — conservative naming matches what is already defined in the existing config schema.
- **Trade-offs**:
  1. Underscore convention is consistent with YAML best practices and the existing config schema
  2. Adding new command keys requires updating both the config schema documentation and the fallback table
- **Reviewer Notes**: Ensure all seven command keys are documented. Verify no workflow needs a command key not in this set.

### Decision 4: Phase-Aware Setup Boundaries

- **Decision**: Setup is split into two tiers — "lightweight" (symlinks, runtimes, git config) runs for ALL phases; "full" (dependency install, Prisma, Playwright) runs ONLY for phases that execute code (implement, build, verify, health-scan tests). Specify and plan phases never trigger full setup.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1). Same signal analysis.
- **Fallback Triggered?**: Yes — preserving existing phase-aware conditionals is the conservative and correct choice.
- **Trade-offs**:
  1. Maintains current workflow speed for specify/plan phases (no unnecessary dependency installation)
  2. Requires the setup layer to accept a "phase" or "mode" parameter rather than running unconditionally
- **Reviewer Notes**: This was the exact issue that caused the AIB-468 revert — `setup-environment.sh` ran unconditionally. Validate that the phase parameter gates full setup correctly for every workflow.

## User Scenarios & Testing

### User Story 1 — External Project Runs ai-board Workflows (Priority: P1)

A project maintainer connects an external repository (e.g., a Python/Django or Go project) to ai-board. When they create a ticket and trigger a workflow, the system reads the project's `.ai-board/config.yml` to determine how to install dependencies, run tests, and execute build commands — without requiring the external repo to match ai-board's own tech stack.

**Why this priority**: This is the core value proposition. Without universal command execution, external projects cannot use ai-board workflows at all.

**Independent Test**: Can be tested by creating a mock `.ai-board/config.yml` with non-bun commands (e.g., `npm install`, `pytest`) and verifying that `run-command.sh` reads and executes them correctly.

**Acceptance Scenarios**:

1. **Given** a target repository with `.ai-board/config.yml` defining `commands.install: npm ci` and `commands.test_unit: npm test`, **When** a workflow invokes `run-command.sh <target-dir> install`, **Then** the script executes `npm ci` in the target directory and returns its exit code.
2. **Given** a target repository with `.ai-board/config.yml` that does NOT define `commands.lint`, **When** a workflow invokes `run-command.sh <target-dir> lint`, **Then** the script exits with code 0 silently (no error, no output).
3. **Given** a target repository with `.ai-board/config.yml` defining `commands.test_e2e: npx playwright test`, **When** the command fails with exit code 1, **Then** `run-command.sh` returns exit code 1 faithfully to the calling workflow step.

---

### User Story 2 — ai-board Continues Working Without Regression (Priority: P1)

The ai-board project itself (which already has `.ai-board/config.yml`) continues to function identically after the workflow changes. All existing specify, plan, implement, verify, and health-scan workflows produce the same results as before.

**Why this priority**: Backward compatibility is equally critical — breaking the existing system while universalizing it defeats the purpose.

**Independent Test**: Run each workflow type against the ai-board repository and confirm all steps complete with the same outcomes as the current hardcoded workflows.

**Acceptance Scenarios**:

1. **Given** the ai-board repository with its existing `.ai-board/config.yml`, **When** a speckit specify workflow runs, **Then** only lightweight setup executes (symlinks, runtimes) — no dependency installation, no Prisma, no Playwright.
2. **Given** the ai-board repository, **When** a speckit implement workflow runs, **Then** full setup executes in the correct order: symlinks → runtimes → dependency install → Prisma detect → Prisma generate/migrate/seed → Playwright detect → Playwright install.
3. **Given** a target repository with NO `.ai-board/config.yml` file, **When** any workflow runs, **Then** the system falls back to hardcoded default commands matching ai-board's current behavior and completes successfully.

---

### User Story 3 — Workflow Starts Only Required Services (Priority: P2)

When the ai-board app dispatches a workflow for a project, it passes the appropriate `needs_<service>` and `<service>_version` inputs. The workflow starts only the requested database/cache containers, avoiding resource waste for projects that don't need specific services.

**Why this priority**: Service flexibility is required for external projects with different database stacks, but the dispatch-side integration (app code changes) is a separate concern from the workflow YAML changes.

**Independent Test**: Can be tested by dispatching a workflow with `needs_postgres: true, postgres_version: '16'` and confirming the PostgreSQL 16 container starts, while a dispatch with `needs_postgres: false` confirms no PostgreSQL container starts.

**Acceptance Scenarios**:

1. **Given** a workflow dispatched with `needs_postgres: true` and `postgres_version: '16'`, **When** the job starts, **Then** a PostgreSQL 16 service container is running and accessible on port 5432.
2. **Given** a workflow dispatched with `needs_postgres: false`, **When** the job starts, **Then** no PostgreSQL container is started and no port 5432 is bound.
3. **Given** a workflow dispatched with `needs_redis: true` and `redis_version: '7'`, **When** the job starts, **Then** a Redis 7 service container is running and accessible on port 6379.
4. **Given** a workflow dispatched with all `needs_*` inputs set to false, **When** the job starts, **Then** no service containers are started (zero overhead).

---

### User Story 4 — Lightweight Workflows Stay Lightweight (Priority: P2)

Workflows that do not execute project code (ai-board-assist, iterate) continue to skip dependency installation, Prisma setup, and Playwright setup — even after the universalization changes.

**Why this priority**: Maintaining the speed of lightweight workflows is important for developer experience and CI cost efficiency.

**Independent Test**: Trigger an ai-board-assist workflow and confirm that no dependency install, Prisma, or Playwright steps execute.

**Acceptance Scenarios**:

1. **Given** an ai-board-assist workflow is dispatched, **When** setup completes, **Then** only symlinks, bun, node, and git config steps have executed — no dependency installation or database setup.
2. **Given** an iterate workflow is dispatched, **When** setup completes, **Then** only symlinks, bun, node, and git config steps have executed.

---

### Edge Cases

- What happens when `.ai-board/config.yml` exists but has malformed YAML syntax? The system fails with a clear error message identifying the parse failure, rather than silently falling back to defaults.
- What happens when a command value in config is an empty string (e.g., `test_e2e: ""`)? The system treats it as undefined and skips silently (same as missing key).
- What happens when `run-command.sh` is invoked with an unrecognized command key (e.g., `deploy`)? The system skips silently (exit 0) since the key won't be found in config.
- What happens when a workflow is dispatched with `needs_postgres: true` but `postgres_version` is empty? The system uses a sensible default version (e.g., `14`) matching the current hardcoded behavior.
- What happens when `setup-environment.sh` is called with an incorrect relative path? All workflow references must use the `ai-board/.github/scripts/` prefix (workspace-root-relative), never `../ai-board/` — this was the root cause of the AIB-468 revert.
- What happens when a command defined in config references a tool not installed in the workflow runner? The command fails with the tool's own "not found" error, and `run-command.sh` returns that non-zero exit code faithfully.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a centralized `run-command.sh` script at `.github/scripts/run-command.sh` that accepts a target directory and a command key, reads the corresponding command from `.ai-board/config.yml`, and executes it in the target directory.
- **FR-002**: `run-command.sh` MUST support these command keys: `install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`.
- **FR-003**: `run-command.sh` MUST exit with code 0 and produce no output when a command key is not defined in the config file or the config file is missing — silent skip behavior.
- **FR-004**: `run-command.sh` MUST return the executed command's exit code faithfully when a command IS defined and executes.
- **FR-005**: `run-command.sh` MUST treat empty-string command values the same as missing keys (silent skip).
- **FR-006**: All workflow YAML files that run tests or build code MUST accept boolean service inputs (`needs_postgres`, `needs_redis`, `needs_mysql`, `needs_mongo`) with corresponding version inputs (`postgres_version`, `redis_version`, `mysql_version`, `mongo_version`).
- **FR-007**: Service containers MUST only start when their corresponding `needs_*` input is true; when false, the service image MUST resolve to an empty string resulting in no container.
- **FR-008**: All hardcoded project-specific commands (`bun run test:unit`, `npx playwright test`, `bun install --frozen-lockfile`, `bunx`, etc.) in workflow YAML files MUST be replaced with calls to `run-command.sh` using the appropriate command key.
- **FR-009**: Phase-aware conditional logic MUST be preserved — specify and plan phases MUST NOT trigger dependency installation, Prisma setup, or Playwright setup.
- **FR-010**: The execution order within each workflow MUST be preserved: symlinks → runtimes → dependencies → detect → Prisma → Playwright.
- **FR-011**: All script path references in workflows MUST use the `ai-board/` prefix (workspace-root-relative), NOT `../ai-board/` or other relative path conventions.
- **FR-012**: When `.ai-board/config.yml` is missing from a target repository, `run-command.sh` MUST fall back to hardcoded default commands matching ai-board's current behavior.
- **FR-013**: The Bun dependency cache step MUST be preserved in workflows where it currently exists.
- **FR-014**: `setup-environment.sh` integration MUST accept a phase/mode parameter to distinguish lightweight setup (all phases) from full setup (implement/build phases only).
- **FR-015**: When `.ai-board/config.yml` exists but contains invalid YAML, the system MUST fail with a clear parse error rather than silently falling back to defaults.

### Assumptions

- GitHub Actions supports conditional service container images where an empty string (`image: ''`) results in no container being created.
- The ai-board app (dispatch side) will be updated separately to read project config and pass service inputs when dispatching workflows — this spec covers only the workflow YAML and script changes.
- The `.ai-board/config.yml` schema (version 1) is stable and will not change structure during this implementation.
- `yq` is available in the workflow environment (already bootstrapped by `setup-environment.sh`).
- The `run-command.sh` script path convention (`ai-board/.github/scripts/run-command.sh`) assumes the standard double-checkout layout where `ai-board/` and `target/` (or the target repo name) are sibling directories under the workspace root.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An external project with a non-bun tech stack can complete a full specify → plan → implement → verify cycle using ai-board workflows without any hardcoded command failures.
- **SC-002**: All six existing ai-board workflows (speckit, quick-impl, verify, ai-board-assist, iterate, health-scan) pass for the ai-board repository itself with zero behavioral regressions.
- **SC-003**: Specify and plan workflow runs complete without triggering dependency installation, Prisma setup, or Playwright setup — maintaining current execution speed for these phases.
- **SC-004**: A workflow dispatched with `needs_postgres: false` starts zero database containers, reducing service resource usage to zero for projects that don't need PostgreSQL.
- **SC-005**: A target repository without `.ai-board/config.yml` completes all workflow phases using fallback defaults, with no manual intervention required.
- **SC-006**: All workflow script path references use the `ai-board/` prefix convention consistently — zero instances of `../ai-board/` remain in any workflow file.
