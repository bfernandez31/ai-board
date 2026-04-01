# Feature Specification: Create setup-environment.sh Script

**Feature Branch**: `AIB-450-create-setup-environment`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Create a centralized setup-environment.sh script that reads .ai-board/config.yml and replaces duplicated setup blocks across all workflow YAMLs"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Error Handling Strategy for Invalid Config

- **Decision**: Script fails fast with a clear, actionable error message when `.ai-board/config.yml` is missing or contains invalid values. No partial setup is attempted.
- **Policy Applied**: PRAGMATIC (via AUTO)
- **Confidence**: High (0.9) — internal DevOps tooling with clear fail-fast convention established in platform-opening-design.md
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Strict validation catches misconfigurations early, preventing cryptic downstream failures
  2. No graceful degradation means any config error blocks the entire workflow
- **Reviewer Notes**: Verify that error messages include the specific field that failed and an example of the expected value

### Decision 2: Python Runtime Support Scope

- **Decision**: Script supports Node.js-based runtimes (bun, npm, yarn, pnpm) as the primary targets for soft launch. Python runtime support (pip, poetry) is acknowledged in the config schema but treated as a future enhancement — the script parses the config field without error but logs a warning and exits for unsupported runtimes.
- **Policy Applied**: PRAGMATIC (via AUTO)
- **Confidence**: High (0.9) — acceptance criteria explicitly list "bun, npm, yarn, pnpm" and the platform-opening-design targets TypeScript/Node.js projects first
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Focused scope accelerates delivery for the soft launch audience
  2. Python users would need a follow-up ticket to get full support
- **Reviewer Notes**: Confirm that the config parser does not reject Python-related fields; it should simply skip unsupported runtimes with a warning

### Decision 3: Symlink Behavior When Plugin Directories Already Exist

- **Decision**: Script removes existing symlinks before creating new ones (idempotent operation). If real directories (not symlinks) exist at the target paths, the script warns and exits with error to prevent accidental data loss.
- **Policy Applied**: PRAGMATIC (via AUTO)
- **Confidence**: High (0.9) — idempotent setup is standard practice for CI scripts; protecting real directories prevents accidental data loss
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Idempotent symlinks allow safe re-runs without cleanup
  2. Failing on real directories adds a small friction point but prevents data loss
- **Reviewer Notes**: Ensure the warning message clearly explains what the user should do (remove or rename the conflicting directory)

### Decision 4: Environment Variable Merge Precedence

- **Decision**: Workflow secrets (GitHub Actions secrets) take precedence over values defined in `.ai-board/config.yml` `env` section. Config env vars are exported first, then secrets overlay them.
- **Policy Applied**: PRAGMATIC (via AUTO)
- **Confidence**: High (0.9) — platform-opening-design.md explicitly states "secrets take priority"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Secrets override prevents accidental exposure of sensitive values via config
  2. Users must understand that config env vars can be silently overridden
- **Reviewer Notes**: Validate that the merge order is documented in the script's inline comments

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workflow Runs Setup Script on a Standard Node.js Project (Priority: P1)

A workflow triggers on a target repository that has a valid `.ai-board/config.yml` with bun as the package manager and claude-code as the agent CLI. The setup script installs the correct Node.js version, installs bun, runs dependency installation, installs Claude Code CLI, exports environment variables, and creates plugin symlinks — all in a single script invocation.

**Why this priority**: This is the core happy path that replaces the 15-20 lines of duplicated setup across every workflow. Without this working, no workflow can use the new setup layer.

**Independent Test**: Can be fully tested by providing a mock target directory with a valid config.yml and verifying that all tools are installed and symlinks are created.

**Acceptance Scenarios**:

1. **Given** a target repo with `.ai-board/config.yml` specifying `runtime.manager: bun`, `runtime.node: "22"`, and `agent.cli: claude-code`, **When** the script is invoked with the target directory path, **Then** Node.js 22 is available, bun is installed, dependencies are installed via `bun install`, Claude Code CLI is installed, env vars from config are exported, and `.claude/commands` and `.claude/skills` symlinks point to the ai-board plugin directories.

2. **Given** a target repo with `.ai-board/config.yml` specifying `runtime.manager: npm` and `runtime.node: "20"`, **When** the script is invoked, **Then** Node.js 20 is available, npm is used for dependency installation via the configured `commands.install`, and all other setup steps complete successfully.

---

### User Story 2 - Script Handles Missing or Invalid Config (Priority: P1)

A workflow triggers on a target repository that either lacks `.ai-board/config.yml` or has an invalid one (missing required fields, unsupported runtime manager). The script detects the problem and fails immediately with a clear, actionable error message.

**Why this priority**: Fail-fast behavior is critical for developer experience. Without clear errors, users waste time debugging cryptic downstream failures.

**Independent Test**: Can be tested by running the script against directories with missing config, empty config, and config with invalid field values.

**Acceptance Scenarios**:

1. **Given** a target directory without `.ai-board/config.yml`, **When** the script is invoked, **Then** it exits with a non-zero code and prints an error identifying the missing config file.

2. **Given** a config file with `runtime.manager: unknown_tool`, **When** the script is invoked, **Then** it exits with a non-zero code and prints a message identifying the unsupported package manager and listing supported options.

3. **Given** a config file missing the required `commands.install` field, **When** the script is invoked, **Then** it exits with a non-zero code and prints a message identifying the missing field.

---

### User Story 3 - Script Supports Multiple Package Managers (Priority: P2)

Different target repositories use different package managers (npm, yarn, pnpm, bun). The setup script reads the `runtime.manager` field and installs the correct package manager at the specified version before running the install command.

**Why this priority**: Multi-manager support is essential for the platform to serve external users with diverse tech stacks, but bun support alone covers the dogfooding phase.

**Independent Test**: Can be tested by providing config files with each supported package manager and verifying the correct tool is available after setup.

**Acceptance Scenarios**:

1. **Given** a config with `runtime.manager: yarn` and `runtime.manager_version: "4.1"`, **When** the script runs, **Then** yarn 4.x is available and `commands.install` is executed successfully.

2. **Given** a config with `runtime.manager: pnpm` and `runtime.manager_version: "9"`, **When** the script runs, **Then** pnpm 9.x is available and `commands.install` is executed successfully.

---

### User Story 4 - Script Installs Agent CLI Based on Config (Priority: P2)

The config specifies which AI agent CLI to install (claude-code or codex). The script installs the correct one globally so that downstream workflow steps can invoke it.

**Why this priority**: Agent CLI installation is required for any AI-powered workflow step, but the current default (claude-code) covers existing usage.

**Independent Test**: Can be tested by providing configs with each supported agent CLI value and verifying the CLI binary is available.

**Acceptance Scenarios**:

1. **Given** a config with `agent.cli: claude-code`, **When** the script runs, **Then** the `claude` CLI is available on PATH.

2. **Given** a config with `agent.cli: codex`, **When** the script runs, **Then** the `codex` CLI is available on PATH.

3. **Given** a config with `agent.cli: unsupported-cli`, **When** the script runs, **Then** it exits with a non-zero code and a clear error message.

---

### User Story 5 - Script Creates Plugin Symlinks Idempotently (Priority: P2)

The script creates symlinks for `.claude/commands` and `.claude/skills` pointing to the ai-board plugin directories. If the script runs multiple times (e.g., workflow retries), it replaces existing symlinks without error.

**Why this priority**: Idempotent operation is standard for CI scripts and prevents flaky workflow retries.

**Independent Test**: Can be tested by running the script twice on the same target directory and verifying symlinks are correct after both runs.

**Acceptance Scenarios**:

1. **Given** a target directory with no existing `.claude` directory, **When** the script runs, **Then** `.claude/commands` and `.claude/skills` symlinks are created pointing to the correct ai-board plugin paths.

2. **Given** a target directory where the script has already run, **When** the script runs again, **Then** symlinks are refreshed without errors.

3. **Given** a target directory where `.claude/commands` is a real directory (not a symlink), **When** the script runs, **Then** it warns the user about the conflict and exits with a non-zero code.

---

### Edge Cases

- What happens when the config `env` section contains a variable that conflicts with a GitHub Actions secret? Secrets take precedence (documented in Decision 4).
- What happens when `runtime.manager_version` is omitted? Script installs the latest stable version of the package manager.
- What happens when the script is run outside of GitHub Actions (e.g., locally)? Script should still work for local testing; GitHub-specific features (like `$GITHUB_ENV`) degrade gracefully.
- What happens when network is unavailable during package manager installation? Script fails with the underlying tool's error message; no custom handling needed.
- What happens when `runtime.manager: pip` or `runtime.manager: poetry` is specified? Script logs a warning that Python runtimes are not yet fully supported and exits with a non-zero code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Script MUST read and parse `.ai-board/config.yml` from the target directory passed as the first argument
- **FR-002**: Script MUST validate that required config fields are present (`runtime.manager`, `commands.install`, `agent.cli`) and exit with a clear error if any are missing
- **FR-003**: Script MUST install the Node.js version specified in `runtime.node` (defaulting to the latest LTS if omitted)
- **FR-004**: Script MUST install the package manager specified in `runtime.manager` at the version in `runtime.manager_version` (or latest stable if omitted). Supported managers: bun, npm, yarn, pnpm
- **FR-005**: Script MUST execute the dependency install command from `commands.install`
- **FR-006**: Script MUST install the agent CLI specified in `agent.cli` (claude-code or codex) globally
- **FR-007**: Script MUST export all key-value pairs from the `env` config section as environment variables, with workflow secrets taking precedence over config values
- **FR-008**: Script MUST create symlinks for `.claude/commands` and `.claude/skills` in the target directory pointing to the ai-board plugin directories
- **FR-009**: Script MUST be idempotent — safe to run multiple times on the same target without errors
- **FR-010**: Script MUST exit with a non-zero code and a human-readable error message when any step fails
- **FR-011**: Script MUST log each setup step as it executes for workflow debugging visibility
- **FR-012**: Script MUST warn and exit with error when an unsupported runtime manager is specified

### Key Entities

- **Config File** (`.ai-board/config.yml`): Declarative project configuration containing runtime settings, commands, environment variables, service definitions, and agent preferences. Source of truth for all setup decisions.
- **Target Directory**: The root of the external repository being set up. Receives symlinks, installed dependencies, and exported environment variables.
- **Plugin Directories**: The ai-board repository's `.claude-plugin/commands` and `.claude-plugin/skills` directories that are symlinked into the target for agent CLI access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Setup script completes all steps (install runtime, dependencies, agent CLI, symlinks) in under 3 minutes for a typical Node.js project
- **SC-002**: All existing workflows can replace their duplicated setup blocks with a single script invocation without behavior changes
- **SC-003**: When config is missing or invalid, the script produces an error message that identifies the exact problem within 5 seconds of invocation
- **SC-004**: Script runs successfully on at least 4 different package manager configurations (bun, npm, yarn, pnpm) without modification
- **SC-005**: Workflow maintainers can add support for a new project by creating only a `.ai-board/config.yml` file — no workflow YAML changes required
